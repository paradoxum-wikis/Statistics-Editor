import type Tower from "$lib/towerComponents/tower";
import type { TableData } from "./parser";
import { serializeTable, serializeVariables } from "./serializer";

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

    allSerializedTables.push(
      serializeTable({
        Headers: skin.headers,
        RawHeaders: skin.rawHeaders,
        RawRows: rowsForSerialization,
        MoneyColumns: skin.moneyColumns,
        Name: skin.tableName || "",
      }),
    );

    if (skin.extraTables) {
      for (const extraTable of skin.extraTables) {
        allSerializedTables.push(serializeExtraTable(extraTable));
      }
    }
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
 * Automatically diffs PVP against Regular and writes $FNC-PVP-* arrays
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
        /^\$FNC-(?:PVP-)?(?:COST|DETECTION|UPGRADE|UPGRADEICON)(?:-[A-Z])?\$$/.test(
          key,
        )
      )
        continue;
      variables[key] = val as string;
    }
  };

  preserveTokens(baseSkin);

  const extractFncArrays = (skinJson: any) => {
    const costs: string[] = [];
    const upgrades: string[] = [];
    const icons: string[] = [];

    const detects = { Hidden: -1, Lead: -1, Flying: -1 };
    const curDetects = { Hidden: false, Lead: false, Flying: false };

    costs.push(skinJson.Defaults?.Price?.toString() ?? "0");
    if (skinJson.Defaults?.Detections) {
      for (const type of ["Hidden", "Lead", "Flying"]) {
        if (skinJson.Defaults.Detections[type]) {
          detects[type as keyof typeof detects] = 0;
          curDetects[type as keyof typeof curDetects] = true;
        }
      }
    }

    if (skinJson.Upgrades) {
      skinJson.Upgrades.forEach((up: any, idx: number) => {
        const lvl = idx + 1;
        costs.push(up.Cost?.toString() ?? "0");
        upgrades.push(up.Title ?? "");
        icons.push(up.Image ?? "");

        if (up.Stats?.Detections) {
          for (const type of ["Hidden", "Lead", "Flying"]) {
            if (
              up.Stats.Detections[type] &&
              !curDetects[type as keyof typeof curDetects]
            ) {
              detects[type as keyof typeof detects] = lvl;
              curDetects[type as keyof typeof curDetects] = true;
            }
          }
        }
      });
    }

    const detStr = [
      detects.Hidden !== -1 ? detects.Hidden : "",
      detects.Lead !== -1 ? detects.Lead : "",
      detects.Flying !== -1 ? detects.Flying : "",
    ].join("; ");

    return {
      costStr: costs.join("; "),
      upgradeStr: upgrades.join("; "),
      iconStr: icons.join("; "),
      detStr: detStr,
    };
  };

  const baseFnc = baseSkinJson ? extractFncArrays(baseSkinJson) : null;
  if (baseFnc) {
    if (baseFnc.costStr) variables["$FNC-COST$"] = baseFnc.costStr;
    if (baseFnc.detStr && baseFnc.detStr !== "; ; ")
      variables["$FNC-DETECTION$"] = baseFnc.detStr;
    if (baseFnc.upgradeStr) variables["$FNC-UPGRADE$"] = baseFnc.upgradeStr;
    if (baseFnc.iconStr) variables["$FNC-UPGRADEICON$"] = baseFnc.iconStr;
  }

  for (const skinName of tower.skinNames) {
    const skin = tower.getSkin(skinName);
    if (!skin || !skin.isPvp) continue;

    preserveTokens(skin);

    const pvpJson = tower.json[tower.name]?.[skinName];
    if (!pvpJson) continue;

    const pvpFnc = extractFncArrays(pvpJson);
    if (baseFnc) {
      if (pvpFnc.costStr !== baseFnc.costStr)
        variables["$FNC-PVP-COST$"] = pvpFnc.costStr;

      if (pvpFnc.detStr !== baseFnc.detStr && pvpFnc.detStr !== "; ; ")
        variables["$FNC-PVP-DETECTION$"] = pvpFnc.detStr;

      if (pvpFnc.upgradeStr !== baseFnc.upgradeStr)
        variables["$FNC-PVP-UPGRADE$"] = pvpFnc.upgradeStr;

      if (pvpFnc.iconStr !== baseFnc.iconStr)
        variables["$FNC-PVP-UPGRADEICON$"] = pvpFnc.iconStr;
    }
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
