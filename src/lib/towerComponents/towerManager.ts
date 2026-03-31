import Tower from "./tower";
import { towerNames } from "./towers";
import { resolveToken } from "$lib/neowtext/functions";
import { parseWikitext, type TableData } from "$lib/neowtext/parser";
import { patchWikitext } from "$lib/neowtext/patcher";
import {
  clearWikiOverride,
  loadEffectiveWikitext,
  setWikiOverride,
} from "$lib/neowtext/wikiSource";
import { stripRefs } from "$lib/utils/format";

const wikitextFiles = import.meta.glob("./towers/*.wiki", {
  query: "?raw",
  import: "default",
});

export default class TowerManager {
  towerData: Record<string, any> | null = null;
  towerNames: string[] = [];
  towers: { [name: string]: Tower } = {};

  constructor(
    public dataKey: string | null,
    private debug: () => boolean = () => false,
  ) {}

  static getProfiles(): string[] {
    if (typeof localStorage === "undefined") return ["Default"];
    return JSON.parse(localStorage.getItem("tds_profiles") || '["Default"]');
  }

  static addProfile(name: string): void {
    if (typeof localStorage === "undefined") return;
    const profiles = this.getProfiles();
    if (!profiles.includes(name)) {
      localStorage.setItem("tds_profiles", JSON.stringify([...profiles, name]));
    }
  }

  static deleteProfile(name: string): void {
    if (typeof localStorage === "undefined" || name === "Default") return;
    const profiles = this.getProfiles().filter((p) => p !== name);
    localStorage.setItem("tds_profiles", JSON.stringify(profiles));
    localStorage.removeItem(name);
  }

  /**
   * Generates the wikitext for the given tower without saving it
   * to storage or updating the source overrider.
   * Useful for "unsaved changes" previews.
   */
  generateWikitext(tower: Tower): string | null {
    const src = (tower as any).sourceWikitext;
    if (!src) return null;
    try {
      return patchWikitext(src, tower);
    } catch (err) {
      console.error(
        `[TowerManager] Failed to generate wikitext for ${tower.name}:`,
        err,
      );
      return null;
    }
  }

  saveTower(tower: Tower): string | null {
    if (this.debug())
      console.log(`[TowerManager] saveTower called for ${tower.name}`);
    if (!this.dataKey) return null;

    if (!this.towerData) {
      if (this.debug())
        console.log(
          `[TowerManager] saveTower: Initializing towerData from storage for key: ${this.dataKey}`,
        );
      this.towerData = JSON.parse(localStorage.getItem(this.dataKey) || "{}");
    }

    this.towerData![tower.name] = structuredClone(tower.json[tower.name]);
    this.save();

    const patched = this.generateWikitext(tower);
    if (patched) {
      if (this.debug())
        console.log(
          `[TowerManager] Patched wikitext length: ${patched.length}`,
        );
      setWikiOverride(this.dataKey ?? "Default", tower.name, patched);
      Object.assign(tower, {
        sourceWikitext: patched,
        wikitextSource: "override",
      });
      return patched;
    }
    return null;
  }

  save(): void {
    if (!this.dataKey) return;
    if (this.debug()) {
      console.log(`[TowerManager] Saving data to key: ${this.dataKey}`);
      console.log(`[TowerManager] Data being saved:`, this.towerData);
    }
    const stringified = JSON.stringify(this.towerData);
    if (this.debug())
      console.log(`[TowerManager] Stringified data:`, stringified);
    localStorage.setItem(this.dataKey, stringified);
  }

  clearCache(name: string): void {
    if (this.debug()) console.log(`[TowerManager] clearing cache for ${name}`);
    if (this.towers[name]) delete this.towers[name];
  }

  resetTower(name: string): void {
    if (!this.dataKey) return;

    if (!this.towerData) {
      if (this.debug())
        console.log(
          `[TowerManager] resetTower: Initializing towerData from storage for key: ${this.dataKey}`,
        );
      this.towerData = JSON.parse(localStorage.getItem(this.dataKey) || "{}");
    }

    if (this.towerData![name]) {
      delete this.towerData![name];
      this.save();
    }
    clearWikiOverride(this.dataKey ?? "Default", name);
    this.clearCache(name);
  }

  async getTower(name: string): Promise<Tower | null> {
    if (this.towers[name]) {
      if (this.debug())
        console.log(`[TowerManager] Returning cached tower for ${name}`);
      return this.towers[name];
    }

    if (this.debug())
      console.log(`[TowerManager] Loading tower ${name} (no cache)`);

    const wikitextLoader = wikitextFiles[`./towers/${name}.wiki`];
    if (!wikitextLoader) return null;

    try {
      const loadBase = async () => {
        try {
          const url = new URL(`./towers/${name}.wiki`, import.meta.url).href;
          if (this.debug())
            console.log(`[TowerManager] Fetching wikitext from: ${url}`);
          const res = await fetch(`${url}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const text = await res.text();
          if (this.debug()) console.log("[TowerManager] Fetch successful");
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
        this.dataKey ?? "Default",
        name,
        loadBase,
      );
      if (this.debug())
        console.log(
          `[TowerManager] Loaded effective wikitext from ${source}, length: ${text.length}`,
        );

      const parsed = parseWikitext(text);

      if (this.debug()) {
        console.log(`[TowerManager] Using wikitext source: ${source}`);
        console.log("[TowerManager] Parsed Variables:", parsed.variables);
      }

      const towerJson: any = {};

      const buildSkinJson = (
        tableData: TableData,
        isPvp: boolean,
        extraTables: TableData[],
      ) => {
        const defaults: any = {};
        const upgrades: any[] = [];
        const readOnly = new Set<string>();
        const curDetections: Record<string, boolean> = {
          Lead: false,
          Hidden: false,
          Flying: false,
        };

        const rows = [...tableData.rows];

        const formulaTokens = Object.fromEntries(
          Object.entries(parsed.variables).filter(
            ([k]) => !k.startsWith("$PVP-"),
          ),
        );
        if (isPvp) {
          Object.entries(parsed.variables).forEach(([k, v]) => {
            if (k.startsWith("$PVP-")) formulaTokens[`$${k.slice(5)}`] = v;
          });
        }

        const getArr = (val?: string) =>
          val ? val.split(";").map((s) => s.trim()) : [];
        const v = parsed.variables;

        const baseCosts = getArr(v["$FNC-COST$"]);
        const baseDetects = getArr(v["$FNC-DETECTION$"]);
        const baseUpgs = getArr(v["$FNC-UPGRADE$"]);
        const baseIcons = getArr(v["$FNC-UPGRADEICON$"]);

        const mergeArrays = (base: string[], pvp?: string[]) => {
          if (!pvp || pvp.length === 0) return base;
          const max = Math.max(base.length, pvp.length);
          return Array.from({ length: max }, (_, i) => {
            const pv = pvp[i]?.trim();
            return pv !== undefined && pv !== "" ? pv : (base[i] ?? "");
          });
        };

        const costs = isPvp
          ? mergeArrays(baseCosts, getArr(v["$FNC-PVP-COST$"]))
          : baseCosts;
        const detects = isPvp
          ? mergeArrays(baseDetects, getArr(v["$FNC-PVP-DETECTION$"]))
          : baseDetects;
        const upgs = isPvp
          ? mergeArrays(baseUpgs, getArr(v["$FNC-PVP-UPGRADE$"]))
          : baseUpgs;
        const icons = isPvp
          ? mergeArrays(baseIcons, getArr(v["$FNC-PVP-UPGRADEICON$"]))
          : baseIcons;

        const parseDetectLevel = (t?: string) => {
          const s = t?.trim();
          if (!s) return -1;
          const n = Number(s);
          return Number.isFinite(n) ? n : -1;
        };

        const detLvls = {
          Hidden: parseDetectLevel(detects[0]),
          Lead: parseDetectLevel(detects[1]),
          Flying: parseDetectLevel(detects[2]),
        };

        const cellFormulaTokens: Record<string, Record<string, string>> = {};
        let prevPrice = 0;

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const row = rows[rowIdx];
          const numericLevel = Number(row["Level"]);
          const levelKey = String(rowIdx);
          cellFormulaTokens[levelKey] ??= {};
          const formulaEntries = (Object.entries(row) as [string, unknown][])
            .map(([k, v]): [string, string, string] | null => {
              if (typeof v !== "string") return null;
              const stripped = stripRefs(v).trim();
              if (!/^\$[^$]+\$$/.test(stripped)) return null;
              return [k, stripped, v];
            })
            .filter((x): x is [string, string, string] => x !== null);

          for (let pass = 0; pass < 2; pass++) {
            for (const [key, val, ogVal] of formulaEntries) {
              const result = resolveToken(
                val,
                Number.isFinite(numericLevel) ? numericLevel : rowIdx,
                row,
                formulaTokens,
                isPvp,
              );
              if (result !== undefined) {
                readOnly.add(key);
                cellFormulaTokens[levelKey][key] = ogVal;
                row[key] = result;
              }
            }
          }

          const tpRaw = row["Total Price"];
          const totalPrice =
            typeof tpRaw === "string"
              ? Number(tpRaw.replace(/[^0-9.-]+/g, ""))
              : Number(tpRaw);

          const detections: Record<string, boolean> = {};
          for (const type of ["Hidden", "Lead", "Flying"]) {
            if (
              Number.isFinite(numericLevel) &&
              numericLevel === detLvls[type as keyof typeof detLvls]
            ) {
              if (this.debug())
                console.log(
                  `[TowerManager] Found detection var ${type} at level ${numericLevel}`,
                );
              curDetections[type] = true;
            }
            if (curDetections[type]) detections[type] = true;
          }

          if (Number.isFinite(numericLevel) && numericLevel === 0) {
            Object.assign(defaults, row, { Price: totalPrice });
            if (Object.keys(detections).length)
              defaults.Detections = detections;
            prevPrice = totalPrice;
          } else {
            const parsedCost = Number(
              costs[Number.isFinite(numericLevel) ? numericLevel : 0]?.replace(
                /[^0-9.-]+/g,
                "",
              ),
            );
            const cost = !isNaN(parsedCost)
              ? parsedCost
              : totalPrice - prevPrice;
            prevPrice = totalPrice;

            const upgrade: any = { Cost: cost, Stats: row };
            if (Object.keys(detections).length)
              upgrade.Stats.Detections = detections;
            const upgIndex = Number.isFinite(numericLevel)
              ? numericLevel - 1
              : -1;
            if (upgIndex >= 0 && upgs[upgIndex]) upgrade.Title = upgs[upgIndex];
            if (upgIndex >= 0 && icons[upgIndex])
              upgrade.Image = icons[upgIndex];

            upgrades.push(upgrade);
          }
        }

        const resolvedExtraTables = extraTables.map((extra) => {
          const extraReadOnly = new Set<string>(
            extra.rows.flatMap((r) =>
              Object.entries(r)
                .filter(([, val]) => {
                  if (typeof val !== "string") return false;
                  return /^\$[^$]+\$$/.test(stripRefs(val).trim());
                })
                .map(([k]) => k),
            ),
          );

          const cellFormulaTokens: Record<string, Record<string, string>> = {};

          return {
            ...extra,
            readOnlyColumns: Array.from(extraReadOnly),
            cellFormulaTokens,
            rows: extra.rows.map((row, extraIdx) => {
              const resRow = { ...row };
              const levelKey = String(extraIdx);
              cellFormulaTokens[levelKey] ??= {};
              const numericLevel = Number(resRow["Level"]);
              for (const key of extraReadOnly) {
                const originalVal = resRow[key] as string;
                const stripped = stripRefs(originalVal).trim();
                const result = resolveToken(
                  stripped,
                  Number.isFinite(numericLevel) ? numericLevel : extraIdx,
                  resRow,
                  formulaTokens,
                  isPvp,
                );
                if (result !== undefined) {
                  cellFormulaTokens[levelKey][key] = originalVal;
                  resRow[key] = result;
                }
              }
              return resRow;
            }),
          };
        });

        return {
          Defaults: defaults,
          Upgrades: upgrades,
          Headers: tableData.headers,
          RawHeaders: tableData.rawHeaders,
          TableName: tableData.name || "",
          RawRows: rows,
          ReadOnly: Array.from(readOnly),
          FormulaTokens: formulaTokens,
          CellFormulaTokens: cellFormulaTokens,
          IsPvp: isPvp,
          MoneyColumns: tableData.moneyColumns ?? [],
          ExtraTables: resolvedExtraTables,
        };
      };

      for (const [tabName, tables] of Object.entries(parsed.tabs)) {
        const isPvp = /pvp/i.test(tabName);
        const pIdx = (tables as TableData[]).findIndex((t) =>
          t.headers.includes("Level"),
        );
        const primaryTable = pIdx !== -1 ? tables[pIdx] : tables[0];
        const extraTables = (tables as TableData[]).filter(
          (_, i) => i !== Math.max(0, pIdx),
        );

        towerJson[tabName] = buildSkinJson(primaryTable, isPvp, extraTables);
      }

      const towerData = new Tower(name, towerJson);
      Object.assign(towerData, {
        sourceWikitext: text,
        wikitextSource: source,
      });

      return (this.towers[name] = towerData);
    } catch (err) {
      console.error("Failed to load wikitext for", name, ":", err);
      return null;
    }
  }

  async getTowerNames(): Promise<string[]> {
    return this.towerNames.length
      ? this.towerNames
      : (this.towerNames = [...towerNames]);
  }
}
