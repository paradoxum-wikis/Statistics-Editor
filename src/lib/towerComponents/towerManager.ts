import Tower from "./tower";
import { towerNames } from "./towers";
import { parseWikitext } from "$lib/wikitext/parser";
import { evaluateFormula } from "$lib/wikitext/evaluator";
import { settingsStore } from "$lib/stores/settings.svelte";

const wikitextFiles = import.meta.glob("./towers/*.wikitext", {
  query: "?raw",
  import: "default",
});

interface TowerManagerOptions {}

interface TowerData {
  [towerName: string]: any;
}

/**
 * Manages loading, saving, and caching of tower data.
 */
class TowerManager {
  dataKey: string | null;
  towerData: TowerData | null;
  towerNames: string[];
  towers: { [name: string]: Tower };

  constructor(dataKey: string | null, options: TowerManagerOptions = {}) {
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
   * Updates a specific tower in the local data and saves everything.
   */
  saveTower(tower: Tower): void {
    if (!this.dataKey) return;

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
  }

  /**
   * Persists the current tower data to local storage, stripping out proxies.
   */
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
    if (this.towers[name]) {
      delete this.towers[name];
    }
  }

  /**
   * Removes any local overrides for a tower, reverting it to the default Wikitext version.
   */
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
    this.clearCache(name);
  }

  /**
   * Loads a tower's data. Checks for local overrides first, then falls back to fetching and parsing the Wikitext definition.
   */
  async getTower(name: string): Promise<Tower | null> {
    if (this.towers[name]) return this.towers[name];

    if (this.dataKey) {
      if (!this.towerData) {
        const localData = localStorage.getItem(this.dataKey);
        if (settingsStore.debugMode) {
          console.log(
            `[TowerManager] getTower: Initializing towerData from storage for key: ${this.dataKey}`,
          );
        }
        this.towerData = localData ? JSON.parse(localData) : {};
      }

      if (this.towerData && this.towerData[name]) {
        const towerData = new Tower(name, this.towerData[name]);
        this.towers[name] = towerData;
        return towerData;
      }
    }

    const wikitextName = name.replace(/ /g, "_");
    const wikitextPath = `./towers/${wikitextName}.wikitext`;
    const wikitextLoader = wikitextFiles[wikitextPath];

    if (wikitextLoader) {
      try {
        let content: string;
        try {
          const url = new URL(wikitextPath, import.meta.url).href;
          if (settingsStore.debugMode)
            console.log(`[TowerManager] Fetching wikitext from: ${url}`);
          const res = await fetch(`${url}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          content = await res.text();
          if (settingsStore.debugMode)
            console.log("[TowerManager] Fetch successful");
        } catch (e) {
          console.warn(
            "[TowerManager] Fetch failed, falling back to loader:",
            e,
          );
          content = (await wikitextLoader()) as string;
        }

        const parsed = parseWikitext(content);
        if (settingsStore.debugMode)
          console.log("[TowerManager] Parsed Variables:", parsed.variables);
        const towerJson: any = {};

        for (const [tabName, tableData] of Object.entries(parsed.tabs)) {
          const skinName = tabName;
          const defaults: any = {};
          const upgrades: any[] = [];
          const readOnlyAttributes: string[] = [];

          const currentDetections: { [key: string]: boolean } = {
            Lead: false,
            Hidden: false,
            Flying: false,
          };

          const rows = tableData.rows.sort(
            (a, b) => Number(a["Level"]) - Number(b["Level"]),
          );

          let previousTotalPrice = 0;

          for (const row of rows) {
            const level = Number(row["Level"]);

            for (const [key, val] of Object.entries(row)) {
              if (
                typeof val === "string" &&
                val.startsWith("$") &&
                parsed.variables[val]
              ) {
                if (!readOnlyAttributes.includes(key)) {
                  readOnlyAttributes.push(key);
                }
                row[key] = evaluateFormula(parsed.variables[val], row);
              }
            }

            const totalPrice =
              typeof row["Total Price"] === "string"
                ? Number(String(row["Total Price"]).replace(/[^0-9.-]+/g, ""))
                : Number(row["Total Price"]);

            const detections: any = {};
            const detectionTypes = ["Lead", "Hidden", "Flying"];
            for (const type of detectionTypes) {
              const varName = `$${level}${type}$`;
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
            if (settingsStore.debugMode)
              console.log(
                `[TowerManager] Level ${level} Detections:`,
                detections,
              );

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

              const titleKey = `$${level}Upgrade$`;
              if (parsed.variables[titleKey]) {
                upgrade.Title = parsed.variables[titleKey];
              }

              const imageKey = `$${level}UpgradeI$`;
              if (parsed.variables[imageKey]) {
                upgrade.Image = parsed.variables[imageKey];
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
          };
        }

        const towerData = new Tower(name, towerJson);
        this.towers[name] = towerData;
        return towerData;
      } catch (err) {
        console.error("Failed to load wikitext for", name, ":", err);
      }
    }

    return null;
  }

  async getTowerNames(): Promise<string[]> {
    if (this.towerNames && this.towerNames.length) return this.towerNames;

    this.towerNames = towerNames.slice();
    return this.towerNames;
  }
}

export default TowerManager;
