import type Tower from "$lib/towerComponents/tower";
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

    const tableMarkup = serializeTable({
      Headers: skin.headers,
      RawRows: rowsForSerialization,
      MoneyColumns: skin.moneyColumns,
    });

    text = patchSkinTable(text, skinName, tableMarkup, tower.skinNames);
  }

  return text;
}

/**
 * Reconstructs the variables map from:
 * - Existing formula tokens (preserved from original parse)
 * - Current detection states (derived from tower data)
 * - Upgrade titles/images (derived from tower data)
 *
 * PVP write `$PVP-` prefixed variables for detections, upgrades,
 * and formula tokens that differ from the regular 'skin.'
 */
function buildVariablesMap(tower: Tower): Record<string, string> {
  const variables: Record<string, string> = {};

  // 1st pass collect regular skin detection states to diff against PVP
  const regularDetections: Record<string, boolean>[] = [];
  const regularUpgradeTitles: Record<number, string> = {};
  const regularUpgradeImages: Record<number, string> = {};
  const regularFormulaTokens: Record<string, string> = {};

  for (const skinName of tower.skinNames) {
    const skin = tower.getSkin(skinName);
    if (!skin || skin.isPvp) continue;

    if (skin.formulaTokens) {
      for (const [key, val] of Object.entries(skin.formulaTokens)) {
        if (
          /^\$\d+(?:Lead|Hidden|Flying)\$$/.test(key) ||
          /^\$\d+UpgradeI?\$$/.test(key)
        ) {
          continue;
        }
        regularFormulaTokens[key] = val;
      }
    }

    const skinJson = tower.json[tower.name]?.[skinName];
    if (!skinJson) continue;

    const detectionTypes = ["Lead", "Hidden", "Flying"];
    const currentDetections: Record<string, boolean> = {
      Lead: false,
      Hidden: false,
      Flying: false,
    };

    // Level 0
    if (skinJson.Defaults?.Detections) {
      for (const type of detectionTypes) {
        if (type in skinJson.Defaults.Detections) {
          currentDetections[type] = skinJson.Defaults.Detections[type] === true;
        }
      }
    }
    regularDetections[0] = { ...currentDetections };

    // Level 1+
    if (skinJson.Upgrades) {
      skinJson.Upgrades.forEach((up: any, idx: number) => {
        const level = idx + 1;
        if (up.Stats?.Detections) {
          for (const type of detectionTypes) {
            if (type in up.Stats.Detections) {
              currentDetections[type] = up.Stats.Detections[type] === true;
            }
          }
        }
        regularDetections[level] = { ...currentDetections };

        if (up.Title) regularUpgradeTitles[level] = up.Title;
        if (up.Image) regularUpgradeImages[level] = up.Image;
      });
    }
  }

  // 2nd pass write vars for all skins
  for (const skinName of tower.skinNames) {
    const skin = tower.getSkin(skinName);
    if (!skin) continue;

    const isPvp = skin.isPvp;
    const prefix = isPvp ? "PVP-" : "";

    if (skin.formulaTokens) {
      for (const [key, val] of Object.entries(skin.formulaTokens)) {
        if (
          /^\$\d+(?:Lead|Hidden|Flying)\$$/.test(key) ||
          /^\$\d+UpgradeI?\$$/.test(key) ||
          /^\$PVP-/.test(key)
        ) {
          continue;
        }

        if (isPvp) {
          if (regularFormulaTokens[key] !== val) {
            const innerKey = key.slice(1, -1); // strip surrounding $
            variables[`$PVP-${innerKey}$`] = val;
          }
        } else {
          variables[key] = val;
        }
      }
    }

    const skinJson = tower.json[tower.name]?.[skinName];
    if (!skinJson) continue;

    const detectionTypes = ["Lead", "Hidden", "Flying"];
    const currentDetections: Record<string, boolean> = {
      Lead: false,
      Hidden: false,
      Flying: false,
    };

    const processLevelDetections = (level: number, detections: any) => {
      if (!detections) return;
      for (const type of detectionTypes) {
        if (!(type in detections)) continue;
        const isEnabled = detections[type] === true;

        if (isEnabled !== currentDetections[type]) {
          if (isPvp) {
            // write PVP detection var only if this type is PVP owned
            // (was explicitly defined or edited in PVP mode)
            if (skin.pvpOwnedDetectionTypes.has(type)) {
              variables[`$PVP-${level}${type}$`] = String(isEnabled);
            }
          } else {
            variables[`$${level}${type}$`] = String(isEnabled);
          }
          currentDetections[type] = isEnabled;
        }
      }
    };

    // Level 0
    processLevelDetections(0, skinJson.Defaults?.Detections);

    // Level 1+
    if (skinJson.Upgrades) {
      skinJson.Upgrades.forEach((up: any, idx: number) => {
        const level = idx + 1;

        processLevelDetections(level, up.Stats?.Detections);

        if (up.Title) {
          if (isPvp && regularUpgradeTitles[level] !== up.Title) {
            variables[`$PVP-${level}Upgrade$`] = `"${up.Title}"`;
          } else if (!isPvp) {
            variables[`$${level}Upgrade$`] = `"${up.Title}"`;
          }
        }

        if (up.Image) {
          if (isPvp && regularUpgradeImages[level] !== up.Image) {
            variables[`$PVP-${level}UpgradeI$`] = `"${up.Image}"`;
          } else if (!isPvp) {
            variables[`$${level}UpgradeI$`] = `"${up.Image}"`;
          }
        }
      });
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
 * Replaces the table for a specific skin, handling both <tabber> sections and single files.
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
    const tableStart = text.indexOf("{|");
    const tableEnd = text.indexOf("|}", tableStart);

    if (tableStart !== -1 && tableEnd !== -1) {
      return (
        text.substring(0, tableStart) +
        newTableMarkup.trim() +
        text.substring(tableEnd + 2)
      );
    }
    return text + "\n" + newTableMarkup;
  }

  // <tabber> mode
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

  const endOfTabContentIndex =
    nextDelimiterIndex === -1
      ? tabberContent.length
      : matchIndexInContent + nextDelimiterIndex;

  const newTabContent = "\n" + newTableMarkup + "\n";
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
