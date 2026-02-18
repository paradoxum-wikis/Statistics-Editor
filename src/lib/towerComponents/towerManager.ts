import Tower from "./tower";
import { towerNames } from "./towers";
import { evaluateFormula } from "$lib/wikitext/evaluator";
import { settingsStore } from "$lib/stores/settings.svelte";
import { parseWikitext, type TableData } from "$lib/wikitext/parser";
import { patchWikitext } from "$lib/wikitext/patcher";
import {
  clearWikiOverride,
  loadEffectiveWikitext,
  setWikiOverride,
} from "$lib/wiki/wikiSource";

/**
 * Resolves a $FNC-$ function for the given row level.
 * Returns the computed numeric value, or undefined if the function is unknown.
 */
function resolveFNC(
  name: string,
  level: number,
  variables: Record<string, string>,
  isPvpSkin: boolean,
): number | undefined {
  if (name === "TOTALPRICE") {
    let total = 0;
    for (let l = 0; l <= level; l++) {
      const pvpKey = `$PVP-${l}Cost$`;
      const baseKey = `$${l}Cost$`;
      const costStr =
        isPvpSkin && variables[pvpKey] !== undefined
          ? variables[pvpKey]
          : variables[baseKey];
      if (costStr !== undefined) {
        const num = Number(String(costStr).replace(/,/g, ""));
        if (!isNaN(num)) total += num;
      }
    }
    return total;
  }
  return undefined;
}

/**
 * Resolves any $Var$ to a value, recursing when a variable points to another token.
 */
function resolveToken(
  token: string,
  level: number,
  row: Record<string, string | number>,
  formulaTokens: Record<string, string>,
  variables: Record<string, string>,
  isPvpSkin: boolean,
  depth = 0,
): string | number | undefined {
  if (depth > 10) return undefined;

  // $FNC-NAME$
  const fncMatch = token.match(/^\$FNC-([A-Z]+)\$$/);
  if (fncMatch) {
    return resolveFNC(fncMatch[1], level, variables, isPvpSkin);
  }

  // $nVar$
  const nVarMatch = token.match(/^\$n(.+)\$$/);
  if (nVarMatch) {
    const suffix = nVarMatch[1];
    const pvpKey = `$PVP-${level}${suffix}$`;
    const baseKey = `$${level}${suffix}$`;
    const varVal =
      isPvpSkin && variables[pvpKey] !== undefined
        ? variables[pvpKey]
        : variables[baseKey];
    if (varVal === undefined) return undefined;
    const num = Number(String(varVal).replace(/,/g, ""));
    return isNaN(num) ? varVal : num;
  }

  // $Var$
  if (token.startsWith("$") && formulaTokens[token] !== undefined) {
    const formulaVal = formulaTokens[token];
    if (/^\$[^$]+\$$/.test(formulaVal)) {
      return resolveToken(
        formulaVal,
        level,
        row,
        formulaTokens,
        variables,
        isPvpSkin,
        depth + 1,
      );
    }
    return evaluateFormula(formulaVal, row);
  }

  return undefined;
}

const wikitextFiles = import.meta.glob("./towers/*.wiki", {
  query: "?raw",
  import: "default",
});

export default class TowerManager {
  dataKey: string | null;
  towerData: Record<string, any> | null;
  towerNames: string[];
  towers: { [name: string]: Tower };

  constructor(dataKey: string | null) {
    this.dataKey = dataKey;
    this.towerData = null;
    this.towerNames = [];
    this.towers = {};
  }

  static getProfiles(): string[] {
    if (typeof localStorage === "undefined") return ["Default"];
    const profiles = localStorage.getItem("tds_profiles");
    return profiles ? JSON.parse(profiles) : ["Default"];
  }

  static addProfile(name: string): void {
    if (typeof localStorage === "undefined") return;
    const profiles = TowerManager.getProfiles();
    if (!profiles.includes(name)) {
      profiles.push(name);
      localStorage.setItem("tds_profiles", JSON.stringify(profiles));
    }
  }

  static deleteProfile(name: string): void {
    if (typeof localStorage === "undefined") return;
    if (name === "Default") return;
    const profiles = TowerManager.getProfiles();
    const index = profiles.indexOf(name);
    if (index > -1) {
      profiles.splice(index, 1);
      localStorage.setItem("tds_profiles", JSON.stringify(profiles));
      localStorage.removeItem(name);
    }
  }

  /**
   * Generates the wikitext for the given tower without saving it
   * to storage or updating the source overrider.
   * Useful for "unsaved changes" previews.
   */
  generateWikitext(tower: Tower): string | null {
    const sourceWikitext = (tower as unknown as { sourceWikitext?: string })
      .sourceWikitext;

    if (!sourceWikitext) return null;

    try {
      return patchWikitext(sourceWikitext, tower);
    } catch (err) {
      console.error(
        `[TowerManager] Failed to generate wikitext for ${tower.name}:`,
        err,
      );
      return null;
    }
  }

  saveTower(tower: Tower): string | null {
    if (settingsStore.debugMode) {
      console.log(`[TowerManager] saveTower called for ${tower.name}`);
    }
    if (!this.dataKey) return null;

    if (!this.towerData) {
      const localData = localStorage.getItem(this.dataKey);
      if (settingsStore.debugMode) {
        console.log(
          `[TowerManager] saveTower: Initializing towerData from storage for key: ${this.dataKey}`,
        );
      }
      this.towerData = localData ? JSON.parse(localData) : {};
    }

    if (this.towerData) {
      this.towerData[tower.name] = JSON.parse(
        JSON.stringify(tower.json[tower.name]),
      );
      this.save();
    }

    const profileName = this.dataKey ?? "Default";

    const patched = this.generateWikitext(tower);

    if (patched) {
      if (settingsStore.debugMode) {
        console.log(
          `[TowerManager] Patched wikitext length: ${patched.length}`,
        );
      }
      setWikiOverride(profileName, tower.name, patched);

      (tower as unknown as { sourceWikitext?: string }).sourceWikitext =
        patched;
      (
        tower as unknown as { wikitextSource?: "override" | "base" }
      ).wikitextSource = "override";

      return patched;
    }
    return null;
  }

  save(): void {
    if (!this.dataKey) return;

    if (settingsStore.debugMode) {
      console.log(`[TowerManager] Saving data to key: ${this.dataKey}`);
      console.log(`[TowerManager] Data being saved:`, this.towerData);
    }

    const plainData = JSON.parse(JSON.stringify(this.towerData));
    const stringified = JSON.stringify(plainData);

    if (settingsStore.debugMode) {
      console.log(`[TowerManager] Stringified data:`, stringified);
    }

    localStorage.setItem(this.dataKey, stringified);
  }

  clearCache(name: string): void {
    if (settingsStore.debugMode) {
      console.log(`[TowerManager] clearing cache for ${name}`);
    }
    if (this.towers[name]) {
      delete this.towers[name];
    }
  }

  resetTower(name: string): void {
    if (!this.dataKey) return;

    if (!this.towerData) {
      const localData = localStorage.getItem(this.dataKey);
      if (settingsStore.debugMode) {
        console.log(
          `[TowerManager] resetTower: Initializing towerData from storage for key: ${this.dataKey}`,
        );
      }
      this.towerData = localData ? JSON.parse(localData) : {};
    }

    if (this.towerData && this.towerData[name]) {
      delete this.towerData[name];
      this.save();
    }

    const profileName = this.dataKey ?? "Default";
    clearWikiOverride(profileName, name);

    this.clearCache(name);
  }

  async getTower(name: string): Promise<Tower | null> {
    if (this.towers[name]) {
      if (settingsStore.debugMode) {
        console.log(`[TowerManager] Returning cached tower for ${name}`);
      }
      return this.towers[name];
    }

    if (settingsStore.debugMode) {
      console.log(`[TowerManager] Loading tower ${name} (no cache)`);
    }

    const wikitextPath = `./towers/${name}.wiki`;
    const wikitextLoader = wikitextFiles[wikitextPath];

    if (!wikitextLoader) return null;

    try {
      const profileName = this.dataKey ?? "Default";

      const loadBase = async (): Promise<string> => {
        try {
          const url = new URL(wikitextPath, import.meta.url).href;
          if (settingsStore.debugMode)
            console.log(`[TowerManager] Fetching wikitext from: ${url}`);
          const res = await fetch(`${url}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const text = await res.text();
          if (settingsStore.debugMode)
            console.log("[TowerManager] Fetch successful");
          return text;
        } catch (e) {
          console.warn(
            "[TowerManager] Fetch failed, falling back to loader:",
            e,
          );
          return (await wikitextLoader()) as string;
        }
      };

      const { source, text } = await loadEffectiveWikitext(
        profileName,
        name,
        loadBase,
      );

      if (settingsStore.debugMode) {
        console.log(
          `[TowerManager] Loaded effective wikitext from ${source}, length: ${text.length}`,
        );
      }

      const parsed = parseWikitext(text) as {
        variables: Record<string, string>;
        tabs: Record<string, TableData>;
      };

      if (settingsStore.debugMode) {
        console.log(`[TowerManager] Using wikitext source: ${source}`);
        console.log("[TowerManager] Parsed Variables:", parsed.variables);
      }

      const towerJson: any = {};

      for (const [tabName, tableDataUnknown] of Object.entries(parsed.tabs)) {
        const tableData = tableDataUnknown as TableData;

        const skinName = tabName;
        const isPvpSkin = /pvp/i.test(skinName);
        const defaults: any = {};
        const upgrades: any[] = [];
        const readOnlyAttributes: string[] = [];

        const currentDetections: { [key: string]: boolean } = {
          Lead: false,
          Hidden: false,
          Flying: false,
        };

        const rows = tableData.rows.sort(
          (
            a: Record<string, string | number>,
            b: Record<string, string | number>,
          ) => Number(a["Level"]) - Number(b["Level"]),
        );

        // Build skin specific formula tokens
        // For PVP, $PVP-N$ overrides $N$ so the PVP tab can use
        // different formulas while falling back to the regular ones
        const formulaTokens: Record<string, string> = {};
        for (const [key, val] of Object.entries(parsed.variables)) {
          if (!/^\$PVP-/.test(key)) {
            formulaTokens[key] = val;
          }
        }
        if (isPvpSkin) {
          for (const [key, val] of Object.entries(parsed.variables)) {
            const pvpMatch = key.match(/^\$PVP-(.+)\$$/);
            if (pvpMatch) {
              const regularKey = `$${pvpMatch[1]}$`;
              formulaTokens[regularKey] = val;
            }
          }
        }

        const detectionTypes = ["Lead", "Hidden", "Flying"];
        const pvpOwnedDetectionTypes = new Set<string>();

        if (isPvpSkin) {
          for (const type of detectionTypes) {
            const hasPvpVar = Object.keys(parsed.variables).some((k) =>
              new RegExp(`^\\$PVP-\\d+${type}\\$$`).test(k),
            );
            if (hasPvpVar) {
              pvpOwnedDetectionTypes.add(type);
            }
          }
        }

        const cellFormulaTokens: Record<string, Record<string, string>> = {};

        let previousTotalPrice = 0;

        for (const row of rows) {
          const level = Number(row["Level"]);
          const levelKey = String(level);
          if (!cellFormulaTokens[levelKey]) cellFormulaTokens[levelKey] = {};

          for (const [key, val] of Object.entries(row)) {
            if (typeof val !== "string" || !/^\$[^$]+\$$/.test(val)) continue;

            const result = resolveToken(
              val,
              level,
              row,
              formulaTokens,
              parsed.variables,
              isPvpSkin,
            );
            if (result !== undefined) {
              if (!readOnlyAttributes.includes(key))
                readOnlyAttributes.push(key);
              cellFormulaTokens[levelKey][key] = val;
              row[key] = result;
            }
          }

          const totalPrice =
            typeof row["Total Price"] === "string"
              ? Number(String(row["Total Price"]).replace(/[^0-9.-]+/g, ""))
              : Number(row["Total Price"]);

          const detections: any = {};
          for (const type of detectionTypes) {
            let varName: string;
            if (isPvpSkin && pvpOwnedDetectionTypes.has(type)) {
              varName = `$PVP-${level}${type}$`;
            } else {
              varName = `$${level}${type}$`;
            }

            if (parsed.variables[varName]) {
              if (settingsStore.debugMode)
                console.log(
                  `[TowerManager] Found detection var ${varName}: ${parsed.variables[varName]}`,
                );
              currentDetections[type] = parsed.variables[varName] === "true";
            }

            if (currentDetections[type]) {
              detections[type] = true;
            }
          }

          if (level === 0) {
            Object.assign(defaults, row);
            defaults.Price = totalPrice;
            if (Object.keys(detections).length > 0) {
              defaults.Detections = detections;
            }
            previousTotalPrice = totalPrice;
          } else {
            const cost = totalPrice - previousTotalPrice;
            previousTotalPrice = totalPrice;

            const upgrade: any = {
              Cost: cost,
              Stats: row,
            };

            if (Object.keys(detections).length > 0) {
              upgrade.Stats.Detections = detections;
            }

            const titleKey = isPvpSkin
              ? `$PVP-${level}Upgrade$`
              : `$${level}Upgrade$`;
            const titleFallback = `$${level}Upgrade$`;
            if (parsed.variables[titleKey]) {
              upgrade.Title = parsed.variables[titleKey];
            } else if (isPvpSkin && parsed.variables[titleFallback]) {
              upgrade.Title = parsed.variables[titleFallback];
            }

            const imageKey = isPvpSkin
              ? `$PVP-${level}UpgradeI$`
              : `$${level}UpgradeI$`;
            const imageFallback = `$${level}UpgradeI$`;
            if (parsed.variables[imageKey]) {
              upgrade.Image = parsed.variables[imageKey];
            } else if (isPvpSkin && parsed.variables[imageFallback]) {
              upgrade.Image = parsed.variables[imageFallback];
            }

            upgrades.push(upgrade);
          }
        }

        towerJson[skinName] = {
          Defaults: defaults,
          Upgrades: upgrades,
          Headers: tableData.headers,
          RawRows: rows,
          ReadOnly: readOnlyAttributes,
          FormulaTokens: formulaTokens,
          CellFormulaTokens: cellFormulaTokens,
          IsPvp: isPvpSkin,
          PvpOwnedDetectionTypes: Array.from(pvpOwnedDetectionTypes),
          MoneyColumns: tableData.moneyColumns ?? [],
        };
      }

      const towerData = new Tower(name, towerJson);

      (towerData as unknown as { sourceWikitext?: string }).sourceWikitext =
        text;
      (
        towerData as unknown as { wikitextSource?: "override" | "base" }
      ).wikitextSource = source;

      this.towers[name] = towerData;
      return towerData;
    } catch (err) {
      console.error("Failed to load wikitext for", name, ":", err);
      return null;
    }
  }

  async getTowerNames(): Promise<string[]> {
    if (this.towerNames && this.towerNames.length) return this.towerNames;
    this.towerNames = towerNames.slice();
    return this.towerNames;
  }
}
