import Tower from "./tower";
import Defaults from "./defaults";
import Upgrade from "./upgrade";
import Levels from "./levels";
import Locator from "./locator";
import { resolveToken } from "$lib/wikitext/functions";

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
  rawRows: any[] = [];
  readOnlyAttributes: string[] = [];
  isPvp: boolean = false;
  moneyColumns: string[] = [];

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

    if (this.data.Headers) {
      this.headers = this.data.Headers;
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

  /**
   * Recompute calculated columns (like DPS) for the current skin using:
   * - `formulaTokens` (token -> expression)
   * - `cellFormulaTokens` (level -> column -> token)
   *
   * This updates:
   * - `this.rawRows` (so persistence keeps numeric recomputed results)
   * - `this.data.Defaults` / `this.data.Upgrades[*].Stats` to match recomputed values
   */
  recomputeCalculatedColumns(): void {
    if (!this.rawRows || !Array.isArray(this.rawRows)) return;
    if (!this.formulaTokens || Object.keys(this.formulaTokens).length === 0)
      return;
    if (
      !this.cellFormulaTokens ||
      Object.keys(this.cellFormulaTokens).length === 0
    )
      return;

    for (let level = 0; level < this.rawRows.length; level++) {
      const row = this.rawRows[level];
      if (!row || typeof row !== "object") continue;

      const levelKey = String(level);
      const perLevel = this.cellFormulaTokens[levelKey];
      if (!perLevel) continue;

      for (const [col, token] of Object.entries(perLevel)) {
        const result = resolveToken(
          token,
          level,
          row as Record<string, string | number>,
          this.formulaTokens,
          this.formulaTokens,
          this.isPvp,
        );
        if (typeof result === "number" && Number.isFinite(result)) {
          row[col] = result;
          this.setDerivedValueAtLevel(level, col, result);
        }
      }
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
    const costKey = `$${level}Cost$`;
    const valueStr = String(value);
    this.formulaTokens[costKey] = valueStr;
    if (this.data.FormulaTokens) this.data.FormulaTokens[costKey] = valueStr;

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

    // Update `rawRows` + recompute any calculated columns before rebuilding Levels
    // This pretty much guarantees cells like DPS update immediately when inputs change
    if (this.rawRows && Array.isArray(this.rawRows)) {
      const targetRowIndex = level;
      const targetRow = this.rawRows[targetRowIndex];
      if (targetRow && typeof targetRow === "object") {
        targetRow[attribute] = newValue;
      }
    }

    this.recomputeCalculatedColumns();
    this.createData();
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
