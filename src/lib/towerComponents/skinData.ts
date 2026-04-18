import Tower from "./tower";
import Defaults from "./defaults";
import Upgrade from "./upgrade";
import Levels from "./levels";
import Locator from "./locator";
import { resolveToken, type TableCache } from "$lib/neowtext/functions";
import type { TableData } from "$lib/neowtext/parser";
import { settingsStore } from "$lib/stores/settings.svelte";
import { stripRefs } from "$lib/utils/format";

type FormulaToken = string; // e.g. "$DPS$", "$DPS2$"
type FormulaTokenMap = Record<string, string>; // token -> expression
type CellFormulaTokenMap = Record<string, Record<string, FormulaToken>>; // level -> column -> token

class SkinData {
  tower: Tower;
  name: string;
  data: any;
  locator!: Locator;
  defaults!: Defaults;
  upgrades!: Upgrade[];
  levels!: Levels;
  headers: string[] = [];
  rawHeaders: string[] = [];
  tableName: string = "";
  rawRows: any[] = [];
  readOnlyAttributes: string[] = [];
  isPvp: boolean = false;
  moneyColumns: string[] = [];
  extraTables: TableData[] = [];
  tableCache: TableCache = {};

  /**
   * Detection types that have PVP specific variables in the source.
   * For types that are not in this set, PVP is inherited from regular vars.
   * When a detection is edited on a PVP skin, the type gets added here so
   * the patcher knows to write `$PVP-` prefixed variables for it. (awesome i know)
   */
  pvpOwnedDetectionTypes: Set<string> = new Set();

  /**
   * Token -> formula expression.
   * Example: { "$DPS$": "...", "$DPS2$": "..." }
   */
  formulaTokens: FormulaTokenMap = {};

  /**
   * Level -> column -> token.
   * Example: { "4": { "DPS": "$DPS2$" } }
   */
  cellFormulaTokens: CellFormulaTokenMap = {};

  constructor(tower: Tower, name: string, data: any) {
    this.tower = tower;
    this.name = name;
    this.data = data;
    this.isPvp = data?.IsPvp ?? false;

    if (
      data?.PvpOwnedDetectionTypes &&
      Array.isArray(data.PvpOwnedDetectionTypes)
    ) {
      this.pvpOwnedDetectionTypes = new Set(data.PvpOwnedDetectionTypes);
    }

    if (!data || typeof data !== "object") {
      console.error(
        `Invalid skin data structure for ${tower.name}.${name}:`,
        data,
      );
      this.data = {
        Defaults: {},
        Upgrades: [],
      };
    }

    // Unwrap inconsistent JSON structures
    while (
      Object.keys(this.data).length === 1 &&
      !this.data.Defaults &&
      !this.data.Upgrades
    ) {
      this.data = this.data[Object.keys(this.data)[0]];
    }

    if (!this.data.Defaults) {
      this.data.Defaults = {};
    }
    if (!this.data.Upgrades || !Array.isArray(this.data.Upgrades)) {
      this.data.Upgrades = [];
    }

    if (this.data.TableName) {
      this.tableName = this.data.TableName;
    }
    if (this.data.Headers) {
      this.headers = this.data.Headers;
    }
    if (this.data.RawHeaders) {
      this.rawHeaders = this.data.RawHeaders;
    }
    if (this.data.RawRows) {
      this.rawRows = this.data.RawRows;
    }

    if (this.data.ReadOnly) {
      this.readOnlyAttributes = this.data.ReadOnly;
    }

    if (
      this.data.FormulaTokens &&
      typeof this.data.FormulaTokens === "object"
    ) {
      this.formulaTokens = this.data.FormulaTokens as FormulaTokenMap;
    }

    if (
      this.data.CellFormulaTokens &&
      typeof this.data.CellFormulaTokens === "object"
    ) {
      this.cellFormulaTokens = this.data
        .CellFormulaTokens as CellFormulaTokenMap;
    }

    if (this.data.MoneyColumns && Array.isArray(this.data.MoneyColumns)) {
      this.moneyColumns = this.data.MoneyColumns;
    }

    if (this.data.ExtraTables && Array.isArray(this.data.ExtraTables)) {
      this.extraTables = this.data.ExtraTables;
    }

    if (this.data.TableCache) {
      this.tableCache = this.data.TableCache;
    }

    this.createData();
  }

  private setDerivedValueAtLevel(level: number, column: string, value: number) {
    if (level === 0) {
      if (this.data?.Defaults) this.data.Defaults[column] = value;
    } else {
      const upgrade = this.data?.Upgrades?.[level - 1];
      if (upgrade?.Stats) upgrade.Stats[column] = value;
    }
  }

  private rebuildTableCache(): void {
    const indexOverrides: Record<string, string> = {};
    const indexVal = this.formulaTokens["$FNC-INDEX$"];
    if (indexVal) {
      for (const entry of indexVal.split(";")) {
        const m = entry.trim().match(/^(.+)\.([^.]+)$/);
        if (m) indexOverrides[m[1].trim()] = m[2].trim();
      }
    }

    const buildCacheFor = (
      tableName: string,
      headers: string[],
      rows: Record<string, string | number>[],
    ) => {
      if (!tableName || !headers.length) return;

      const cleanName = stripRefs(tableName).trim();
      const indexCol =
        indexOverrides[cleanName] || indexOverrides[tableName] || headers[0];

      const tCache: Record<number, Record<string, string | number>> = {};
      for (const row of rows) {
        const s = String(row[indexCol] ?? "");
        const range = s.match(/^(\d+)[^\d]+(\d+)$/);
        if (range) {
          for (let l = parseInt(range[1]); l <= parseInt(range[2]); l++) {
            tCache[l] = row;
          }
        } else {
          const n = parseInt(s);
          if (!isNaN(n)) tCache[n] = row;
        }
      }

      this.tableCache[tableName] = tCache;
      this.tableCache[cleanName] = tCache;
      this.tableCache[cleanName.replace(/\s+/g, "")] = tCache;
    };

    this.tableCache = {};
    buildCacheFor(this.tableName, this.headers, this.rawRows);

    for (const table of this.extraTables) {
      buildCacheFor(table.name, table.headers, table.rows);
    }
  }

  refreshDerivedData(): void {
    if (settingsStore.debugMode) {
      console.log(
        `[SkinData] refreshDerivedData start (skin=${this.name}, table=${this.tableName}, rawRows=${this.rawRows?.length ?? 0})`,
      );
      console.log("[SkinData] tableCache keys:", Object.keys(this.tableCache));
    }

    this.rebuildTableCache();
    this.recomputeCalculatedColumns();
    this.rebuildTableCache();
    this.createData();

    if (settingsStore.debugMode) {
      console.log(
        `[SkinData] refreshDerivedData end (skin=${this.name}, levels=${this.levels?.levels?.length ?? 0})`,
      );
    }
  }

  /**
   * Recompute calculated columns (like DPS) for the current skin using:
   * - `formulaTokens` (token -> expression)
   * - `cellFormulaTokens` (level -> column -> token)
   *
   * This updates:
   * - `this.rawRows` (so persistence keeps numeric recomputed results)
   * - `this.data.Defaults` / `this.data.Upgrades[*].Stats` to match recomputed values
   */
  recomputeCalculatedColumns(onlyLevel?: number): void {
    if (settingsStore.debugMode) {
      console.log(
        `[SkinData] recomputeCalculatedColumns start (skin=${this.name}, onlyLevel=${onlyLevel ?? "all"})`,
      );
    }

    if (this.extraTables && this.extraTables.length > 0) {
      let extraTablesChanged = false;

      for (const table of this.extraTables) {
        if (!table.cellFormulaTokens) continue;

        for (let level = 0; level < table.rows.length; level++) {
          const row = table.rows[level];
          if (!row || typeof row !== "object") continue;

          const perLevel = table.cellFormulaTokens[String(level)];
          if (!perLevel) continue;

          for (let pass = 0; pass < 2; pass++) {
            for (const [col, token] of Object.entries(perLevel)) {
              const levelVal =
                row["Level"] !== undefined
                  ? String(row["Level"]) + (table.branchSuffix || "")
                  : String(level) + (table.branchSuffix || "");

              const result = resolveToken(
                token,
                levelVal,
                row,
                this.formulaTokens,
                this.isPvp,
                0,
                this.tableCache,
              );

              if (result !== undefined) {
                row[col] = result;
                row[stripRefs(col)] = result;
                extraTablesChanged = true;
              }
            }
          }
        }
      }

      if (extraTablesChanged) {
        this.rebuildTableCache();
      }
    }

    if (
      this.rawRows?.length &&
      Object.keys(this.formulaTokens).length &&
      Object.keys(this.cellFormulaTokens).length
    ) {
      const start = onlyLevel ?? 0;
      const end = onlyLevel != null ? onlyLevel + 1 : this.rawRows.length;

      for (let level = start; level < end; level++) {
        const row = this.rawRows[level];
        if (!row || typeof row !== "object") continue;

        const perLevel = this.cellFormulaTokens[String(level)];
        if (!perLevel) continue;

        for (const [col, token] of Object.entries(perLevel)) {
          const result = resolveToken(
            token,
            level,
            row,
            this.formulaTokens,
            this.isPvp,
            0,
            this.tableCache,
          );

          if (result !== undefined) {
            row[col] = result;
            if (typeof result === "number" && Number.isFinite(result)) {
              this.setDerivedValueAtLevel(level, col, result);
            } else if (typeof result === "string") {
              this.setDerivedValueAtLevel(level, col, result as any);
            }
          }
        }
      }
    }

    if (settingsStore.debugMode) {
      console.log(
        `[SkinData] recomputeCalculatedColumns end (skin=${this.name})`,
      );
    }
  }

  createData() {
    this.locator = new Locator();

    this.defaults = new Defaults(this.data.Defaults, this.locator);

    this.upgrades = this.data.Upgrades.map(
      (upgrade: any) => new Upgrade(upgrade, this.locator),
    );

    this.levels = new Levels(this);
  }

  setCost(level: number, value: number): void {
    const costKey =
      this.isPvp && this.formulaTokens["$FNC-PVP-COST$"] !== undefined
        ? "$FNC-PVP-COST$"
        : "$FNC-COST$";
    const costs = (this.formulaTokens[costKey] || "")
      .split(";")
      .map((s) => s.trim());
    costs[level] = String(value);

    const newCostStr = costs.join("; ");
    this.formulaTokens[costKey] = newCostStr;
    if (this.data.FormulaTokens) this.data.FormulaTokens[costKey] = newCostStr;

    this.recomputeCalculatedColumns();
    if (this.rawRows?.length) {
      const sorted = [...this.rawRows].sort(
        (a, b) => Number(a.Level) - Number(b.Level),
      );
      let previous = 0;
      for (const row of sorted) {
        const lvl = Number(row.Level);
        const totalPrice =
          typeof row["Total Price"] === "number" ? row["Total Price"] : 0;
        if (lvl === 0) {
          if (this.data.Defaults) this.data.Defaults.Price = totalPrice;
        } else {
          const upgrade = this.data.Upgrades?.[lvl - 1];
          if (upgrade) upgrade.Cost = totalPrice - previous;
        }
        previous = totalPrice;
      }
    }
    this.createData();
  }

  set(level: number, attribute: string, newValue: any) {
    if (level === 0) {
      this.defaults.set(attribute, newValue);
    } else {
      this.upgrades[level - 1].set(attribute, newValue);
    }

    // Sync the edited value into `rawRows` anj recompute any derived columns
    // such as DPS, then rebuild Levels so dependent cells update
    if (this.rawRows?.[level] && typeof this.rawRows[level] === "object") {
      this.rawRows[level][attribute] = newValue;
    }
    this.recomputeCalculatedColumns(level);
    this.refreshDerivedData();
  }

  get(level: number, attribute: string) {
    if (level === 0) {
      return this.defaults.get(attribute);
    } else {
      return this.upgrades[level - 1].get(attribute);
    }
  }

  setDetection(
    level: number,
    name: string,
    value: boolean,
    rebuild: boolean = true,
  ) {
    if (level === 0) {
      this.defaults.setDetection(name, value);
    } else {
      this.upgrades[level - 1].setDetection(name, value);
    }

    if (this.isPvp) {
      this.pvpOwnedDetectionTypes.add(name);
    }

    if (rebuild) this.createData();
  }
}
export default SkinData;
