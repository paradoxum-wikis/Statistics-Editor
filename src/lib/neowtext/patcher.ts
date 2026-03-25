import type Tower from "$lib/towerComponents/tower";
import type { TableData } from "./parser";
import { serializeTable, serializeVariables } from "./serializer";

/**
 * Updates the given source wikitext with data from the Tower instance.
 * Replaces <var> blocks and specific skin tables while preserving other content.
 */
export function patchWikitext(sourceWikitext: string, tower: Tower): string {
  let text = sourceWikitext;

  const newVariables = buildVariablesMap(tower);
  text = patchVariableBlock(text, newVariables);

  for (const skinName of tower.skinNames) {
    const skin = tower.getSkin(skinName);
    if (!skin) continue;

    const rowsForSerialization = skin.rawRows.map((row) => ({ ...row }));

    if (skin.cellFormulaTokens) {
      for (const row of rowsForSerialization) {
        const level = String(row["Level"]);
        const formulas = skin.cellFormulaTokens[level];
        if (formulas) {
          for (const [col, token] of Object.entries(formulas)) {
            row[col] = token;
          }
        }
      }
    }

    const markups: string[] = [
      serializeTable({
        Headers: skin.headers,
        RawRows: rowsForSerialization,
        MoneyColumns: skin.moneyColumns,
        Name: skin.tableName || "",
      }),
    ];

    for (const table of skin.extraTables ?? []) {
      markups.push(serializeExtraTable(table));
    }

    text = patchSkinTable(text, skinName, markups.join("\n"), tower.skinNames);
  }

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
      if (/^\$FNC-(?:PVP-)?(?:COST|DETECTION|UPGRADE|UPGRADEICON)\$$/.test(key))
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

  const newBlock = serializeVariables(variables);
  return (
    text.substring(0, startIndex) +
    newBlock +
    text.substring(endIndex + endTag.length)
  );
}

/**
 * Finds the start of the first table and the end of the last table
 * in a block of content.
 *
 * Returns [startIndex, endIndex] or null.
 */
function findAllTablesSpan(content: string): [number, number] | null {
  const firstStart = content.indexOf("{|");
  if (firstStart === -1) return null;

  let lastEnd = -1;
  let searchFrom = firstStart;
  while (true) {
    const end = content.indexOf("|}", searchFrom);
    if (end === -1) break;
    lastEnd = end + 2;
    searchFrom = end + 2;
  }

  if (lastEnd === -1) return null;
  return [firstStart, lastEnd];
}

/**
 * Replaces tables for a specific skin.
 */
function patchSkinTable(
  text: string,
  skinName: string,
  newTableMarkup: string,
  allSkinNames: string[],
): string {
  const tabberStart = text.indexOf("<tabber>");
  const tabberEnd = text.indexOf("</tabber>");
  const isTabbed = tabberStart !== -1 && tabberEnd !== -1;

  if (!isTabbed) {
    const span = findAllTablesSpan(text);

    if (span) {
      return (
        text.substring(0, span[0]) +
        newTableMarkup.trim() +
        text.substring(span[1])
      );
    }
    return text + "\n" + newTableMarkup;
  }

  const tabberContent = text.substring(tabberStart + 8, tabberEnd);
  const escapedSkinName = escapeRegExp(skinName);
  const tabHeaderRegex = new RegExp(
    `(^|\\|\\-\\|)\\s*${escapedSkinName}\\s*=\\s*`,
  );
  const match = tabberContent.match(tabHeaderRegex);

  if (!match) {
    console.warn(`[Patcher] Could not find tab for skin: ${skinName}`);
    return text;
  }

  const matchIndexInContent = match.index! + match[0].length;
  const restOfContent = tabberContent.substring(matchIndexInContent);
  const nextDelimiterIndex = restOfContent.indexOf("|-|");

  const tabSection =
    nextDelimiterIndex === -1
      ? restOfContent
      : restOfContent.substring(0, nextDelimiterIndex);

  const endOfTabContentIndex =
    nextDelimiterIndex === -1
      ? tabberContent.length
      : matchIndexInContent + nextDelimiterIndex;

  const span = findAllTablesSpan(tabSection);
  let newTabContent: string;
  if (span) {
    newTabContent =
      tabSection.substring(0, span[0]) +
      newTableMarkup.trim() +
      tabSection.substring(span[1]);
  } else {
    newTabContent = "\n" + newTableMarkup + "\n";
  }

  const newTabberContent =
    tabberContent.substring(0, matchIndexInContent) +
    newTabContent +
    tabberContent.substring(endOfTabContentIndex);

  return (
    text.substring(0, tabberStart + 8) +
    newTabberContent +
    text.substring(tabberEnd)
  );
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeExtraTable(table: TableData): string {
  return serializeTable({
    Headers: table.headers,
    RawRows: table.rows,
    MoneyColumns: table.moneyColumns,
    Name: table.name || "",
  });
}
