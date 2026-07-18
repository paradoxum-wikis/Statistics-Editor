import type Tower from "$lib/towerComponents/tower";
import type { TableData } from "./parser";
import { serializeTable, serializeVariables } from "./serializer";
import { getDefaultFncKey, getFncValue } from "./functions";
import {
  flagsFromSkinJson,
  parseSchema,
  serializeDetectionFlags,
} from "./detection";

/**
 * Updates the given source wikitext with data from the Tower instance.
 * Replaces <var> blocks and specific skin tables while preserving other content.
 */
export function patchWikitext(sourceWikitext: string, tower: Tower): string {
  let text = patchVariableBlock(sourceWikitext, buildVariablesMap(tower));
  const allSerializedTables: string[] = [];

  for (const skinName of tower.skinNames) {
    const skin = tower.getSkin(skinName);
    if (!skin) continue;

    const tokens = skin.cellFormulaTokens;

    const rowsForSerialization = tokens
      ? skin.rawRows.map((row, i) => {
          const levelKey = row["Level"]?.toString() ?? "";
          const formulas = tokens[i] ?? (levelKey && tokens[levelKey]);
          return formulas ? { ...row, ...formulas } : row;
        })
      : skin.rawRows;

    const primarySerialized = serializeTable({
      Headers: skin.headers,
      RawHeaders: skin.rawHeaders,
      RawRows: rowsForSerialization,
      MoneyColumns: skin.moneyColumns,
      Name: skin.tableName || "",
    });

    const ordered = [
      primarySerialized,
      ...(skin.extraTables ?? []).map((extraTable: TableData) =>
        serializeExtraTable(extraTable),
      ),
    ];

    const primaryIdx = Number.isFinite(skin.primaryTableIndex)
      ? Math.max(0, Number(skin.primaryTableIndex))
      : 0;

    if (primaryIdx > 0 && primaryIdx < ordered.length) {
      const [primary] = ordered.splice(0, 1);
      ordered.splice(primaryIdx, 0, primary);
    }

    allSerializedTables.push(...ordered);
  }

  let tableIndex = 0;
  text = text.replace(/\{\|[\s\S]*?\|\}/g, (match) => {
    if (tableIndex < allSerializedTables.length) {
      return allSerializedTables[tableIndex++];
    }
    return match;
  });

  return text;
}

/**
 * Reconstructs the variables map from:
 * - Existing formula tokens (preserved from original parse)
 * - Funcs (Cost, Detection, Upgrades, Icons)
 *
 * Automatically diffs PVP against Regular and writes $FNC-PVP-* / $FSE-PVP-* arrays
 * if the PVP skin deviates from the base tower.
 */
function buildVariablesMap(tower: Tower): Record<string, string> {
  const variables: Record<string, string> = {};

  const baseSkinName =
    tower.skinNames.find((n) => !tower.getSkin(n)?.isPvp) || tower.skinNames[0];
  const baseSkin = tower.getSkin(baseSkinName);
  const baseSkinJson = tower.json[tower.name]?.[baseSkinName];

  const preserveTokens = (skin: any) => {
    if (!skin?.formulaTokens) return;
    for (const [key, val] of Object.entries(skin.formulaTokens)) {
      if (
        /^\$(?:FNC|FSE)-(?:[A-Z0-9]+-)?(?:COST|DETECTION|UPGRADE|UPGRADEICON)(?:-[A-Z])?\$$/.test(
          key,
        )
      )
        continue;
      variables[key] = val as string;
    }
  };

  preserveTokens(baseSkin);

  const schema = parseSchema(
    getFncValue(baseSkin?.formulaTokens ?? {}, "SCHEMA"),
  );

  const extractFncArrays = (skinJson: any) => {
    const costs: string[] = [];
    const upgrades: string[] = [];
    const icons: string[] = [];

    costs.push(skinJson.Defaults?.Price?.toString() ?? "0");

    if (skinJson.Upgrades) {
      skinJson.Upgrades.forEach((up: any) => {
        costs.push(up.Cost?.toString() ?? "0");
        upgrades.push(up.Title ?? "");
        icons.push(up.Image ?? "");
      });
    }

    const detStr = serializeDetectionFlags(
      flagsFromSkinJson(skinJson, schema),
      schema,
    );

    return {
      costStr: costs.join("; "),
      upgradeStr: upgrades.join("; "),
      iconStr: icons.join("; "),
      detStr,
    };
  };

  const hasDetections = (detStr: string) =>
    detStr.split(";").some((s) => s.trim() !== "");

  const baseFnc = baseSkinJson ? extractFncArrays(baseSkinJson) : null;
  if (baseFnc) {
    if (baseFnc.costStr) variables[getDefaultFncKey("COST")] = baseFnc.costStr;
    if (hasDetections(baseFnc.detStr))
      variables[getDefaultFncKey("DETECTION")] = baseFnc.detStr;
    if (baseFnc.upgradeStr)
      variables[getDefaultFncKey("UPGRADE")] = baseFnc.upgradeStr;
    if (baseFnc.iconStr)
      variables[getDefaultFncKey("UPGRADEICON")] = baseFnc.iconStr;
  }

  for (const skinName of tower.skinNames) {
    if (skinName === baseSkinName) continue;

    const skin = tower.getSkin(skinName);
    if (!skin) continue;

    preserveTokens(skin);

    const skinJson = tower.json[tower.name]?.[skinName];
    if (!skinJson) continue;

    const variant = extractFncArrays(skinJson);
    const prefix =
      skin.variantPrefix || skinName.trim().replace(/[^a-zA-Z0-9]+/g, "");
    if (!prefix || !baseFnc) continue;

    if (variant.costStr !== baseFnc.costStr)
      variables[getDefaultFncKey("COST", prefix)] = variant.costStr;

    if (variant.detStr !== baseFnc.detStr && hasDetections(variant.detStr))
      variables[getDefaultFncKey("DETECTION", prefix)] = variant.detStr;

    if (variant.upgradeStr !== baseFnc.upgradeStr)
      variables[getDefaultFncKey("UPGRADE", prefix)] = variant.upgradeStr;

    if (variant.iconStr !== baseFnc.iconStr)
      variables[getDefaultFncKey("UPGRADEICON", prefix)] = variant.iconStr;
  }

  return variables;
}

function patchVariableBlock(
  text: string,
  variables: Record<string, string>,
): string {
  const startTag = "<var>";
  const endTag = "</var>";
  const startIndex = text.indexOf(startTag);
  const endIndex = text.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1) {
    return serializeVariables(variables) + "\n\n" + text;
  }

  const oldBlock = text.substring(startIndex + startTag.length, endIndex);
  const orderedVars: Record<string, string> = {};

  for (const [, key] of oldBlock.matchAll(/^\s*([^=\s]+)\s*=/gm)) {
    if (key in variables) {
      orderedVars[key] = variables[key];
    } else if (key.startsWith("$FNC-")) {
      const fse = "$FSE-" + key.slice(5);
      if (fse in variables) orderedVars[fse] = variables[fse];
    }
  }

  Object.assign(orderedVars, variables);
  const newBlock = serializeVariables(orderedVars);
  return (
    text.substring(0, startIndex) +
    newBlock +
    text.substring(endIndex + endTag.length)
  );
}

function serializeExtraTable(
  table: TableData & {
    cellFormulaTokens?: Record<string, Record<string, string>>;
  },
): string {
  const tokens = table.cellFormulaTokens;

  if (!tokens) {
    return serializeTable({
      Headers: table.headers,
      RawHeaders: table.rawHeaders,
      RawRows: table.rows,
      MoneyColumns: table.moneyColumns,
      Name: table.name || "",
    });
  }

  const rows = table.rows.map((row, i) => {
    const levelKey = row["Level"]?.toString() ?? "";
    const formulas = tokens[i] ?? (levelKey && tokens[levelKey]);
    return formulas ? { ...row, ...formulas } : row;
  });

  return serializeTable({
    Headers: table.headers,
    RawHeaders: table.rawHeaders,
    RawRows: rows,
    MoneyColumns: table.moneyColumns,
    Name: table.name || "",
  });
}
