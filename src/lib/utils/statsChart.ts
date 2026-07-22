import { parseNumeric, stripRefs, toNumericValue } from "$lib/utils/format";
import {
  buildActiveSkinTables,
  buildDisplayRowsCache,
  tableCacheKey,
  type RofInfo,
  type TableConfig,
  type TableRow,
} from "$lib/towerTable";
import {
  parseSchema,
  schemaBranches,
  schemaIndexToLevel,
} from "$lib/neowtext/functions/schema";
import { getEffectiveFncKey, getFncValue } from "$lib/neowtext/functions/keys";
import type SkinData from "$lib/towerComponents/skinData";
import type Tower from "$lib/towerComponents/tower";
import type { GlobalModifier } from "$lib/utils/globalModifier";

export type StatsChartPoint = { x: number; y: number };

export type ComparatorScope =
  | { kind: "linear"; id: string; label: string }
  | { kind: "path"; id: string; label: string; letter: string }
  | { kind: "table"; id: string; label: string; tableIdx: number };

export type ComparatorSeriesDef = {
  id: string;
  towerName: string;
  skinName: string;
  scopeId: string;
  metric: string;
};

export type ComparatorSeriesResult = {
  key: string;
  label: string;
  color: string;
  value: string;
  data: StatsChartPoint[];
};

export type ComparatorSeriesRow = {
  def: ComparatorSeriesDef;
  color: string;
  scopeItems: { value: string; label: string }[];
  metricItems: { value: string; label: string }[];
};

export const MAX_SERIES = 4;
export const X_CASH = "__cash__";
export const X_LEVEL = "__level__";
export const X_COST = "__cost__";

export type ComparatorXKey = typeof X_CASH | typeof X_LEVEL | typeof X_COST;

export const X_AXIS_OPTIONS: { key: ComparatorXKey; label: string }[] = [
  { key: X_LEVEL, label: "Level" },
  { key: X_CASH, label: "Cash Spent" },
  { key: X_COST, label: "Upgrade Cost" },
];

const BASE_CHARTS = 5;
const TIERS = 3;

let paletteCache: { theme: string; colors: string[] } | null = null;

function themeKey(): string {
  if (typeof document === "undefined") return "ssr";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function resolveChartRgb(i: number): [number, number, number] | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.color = `var(--chart-${i})`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const raw = getComputedStyle(probe).color;
  probe.remove();
  const m = raw.match(
    /rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i,
  );
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): string {
  const ch = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${ch(0)} ${ch(1)} ${ch(2)})`;
}

function palette(): string[] {
  const theme = themeKey();
  if (paletteCache?.theme === theme) return paletteCache.colors;
  const colors: string[] = [];
  for (let tier = 0; tier < TIERS; tier++) {
    for (let b = 1; b <= BASE_CHARTS; b++) {
      const rgb = resolveChartRgb(b);
      if (!rgb) {
        colors.push(`var(--chart-${b})`);
        continue;
      }
      if (tier === 0) colors.push(`rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`);
      else if (tier === 1) colors.push(mixRgb(rgb, [255, 255, 255], 0.38));
      else colors.push(mixRgb(rgb, [0, 0, 0], 0.28));
    }
  }
  paletteCache = { theme, colors };
  return colors;
}

export function chartColorAt(i: number): string {
  const p = palette();
  return p[((i % p.length) + p.length) % p.length];
}

function headerLabel(h: string): string {
  return stripRefs(h).trim();
}

function extractCostArray(
  skin: SkinData | null | undefined,
  isPvp: boolean,
): number[] {
  if (!skin?.formulaTokens) return [];
  const tokens = skin.formulaTokens;
  const key =
    isPvp && getFncValue(tokens, "PVP-COST") !== undefined
      ? getEffectiveFncKey(tokens, "PVP-COST")
      : getEffectiveFncKey(tokens, "COST", skin.variantPrefix);
  const raw = tokens[key] || "";
  if (!raw) return [];
  return raw.split(";").map((part) => {
    const n = parseNumeric(part.trim());
    return Number.isFinite(n) ? n : NaN;
  });
}

function shortBranchName(name: string): string {
  return (
    name
      .replace(/\s*path\s*stats\s*$/i, "")
      .replace(/\s*stats\s*$/i, "")
      .replace(/\s*path\s*$/i, "")
      .trim() || name
  );
}

function branchLabels(tokens: Record<string, string>): Record<string, string> {
  const schema = parseSchema(getFncValue(tokens, "SCHEMA"));
  if (!schema?.length) return {};
  const branches = schemaBranches(schema);
  const trunk = branches[0] || "N";
  const letters = branches.filter((b) => b !== trunk);
  const names = (getFncValue(tokens, "BRANCH") || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const map: Record<string, string> = { [trunk]: "Base" };
  letters.forEach((letter, i) => {
    map[letter] = shortBranchName(names[i] || `Path ${letter}`);
  });
  return map;
}

function rowLevel(row: TableRow, i: number): number {
  return (
    toNumericValue(row.Level ?? row["Level"] ?? row["Gravestone Level"]) ?? i
  );
}

// N/A / dashes → 0 so sparse cells still plot.
function chartNumeric(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = stripRefs(v).replace(/,/g, "").trim();
    if (!s) return null;
    if (/^n\/a$/i.test(s) || s === "-" || s === "—" || s === "–") return 0;
  }
  return toNumericValue(v);
}

function cashFromRow(
  row: TableRow,
  addCost: number | null,
  run: number,
): number {
  for (const [k, v] of Object.entries(row)) {
    const l = headerLabel(k).toLowerCase();
    if (l === "total price" || l === "total cost") {
      const n = toNumericValue(v);
      if (n != null) return n;
    }
  }
  return run + (addCost != null && Number.isFinite(addCost) ? addCost : 0);
}

type TowerCtx = {
  active: NonNullable<ReturnType<typeof buildActiveSkinTables>>;
  cache: Map<string, TableRow[]>;
  costs: number[];
  schema: string[] | null;
  trunk: string;
};

type CtxMemo = Map<string, TowerCtx | null>;

function towerCtx(
  tower: Tower,
  skinName: string,
  rofInfo: RofInfo,
  modifier: GlobalModifier,
): TowerCtx | null {
  const active = buildActiveSkinTables(tower, skinName);
  if (!active) return null;
  const tokens = active.skin.formulaTokens ?? {};
  const schema = parseSchema(getFncValue(tokens, "SCHEMA"));
  return {
    active,
    cache: buildDisplayRowsCache(active, skinName, rofInfo, modifier),
    costs: extractCostArray(active.skin, !!active.skin.isPvp),
    schema,
    trunk: schemaBranches(schema)[0] || "N",
  };
}

function getTowerCtx(
  memo: CtxMemo,
  tower: Tower,
  skinName: string,
  rofInfo: RofInfo,
  modifier: GlobalModifier,
): TowerCtx | null {
  const key = `${tower.name}\0${skinName}`;
  if (memo.has(key)) return memo.get(key)!;
  const ctx = towerCtx(tower, skinName, rofInfo, modifier);
  memo.set(key, ctx);
  return ctx;
}

function rowsFor(ctx: TowerCtx, skinName: string, cfg: TableConfig): TableRow[] {
  return ctx.cache.get(tableCacheKey(skinName, cfg.tableIdx)) ?? cfg.rows;
}

export function listScopes(tower: Tower, skinName: string): ComparatorScope[] {
  const skin = tower.getSkin(skinName);
  if (!skin) return [];
  const tokens = skin.formulaTokens ?? {};
  const schema = parseSchema(getFncValue(tokens, "SCHEMA"));
  const labels = branchLabels(tokens);
  const branches = schemaBranches(schema);
  const trunk = branches[0] || "N";
  const pathLetters = branches.filter((b) => b !== trunk);

  const scopes: ComparatorScope[] = pathLetters.length
    ? pathLetters.map((letter) => ({
        kind: "path" as const,
        id: `path:${letter}`,
        letter,
        label: labels[letter] || `Path ${letter}`,
      }))
    : [
        {
          kind: "linear" as const,
          id: "linear",
          label: skin.tableName || "Master",
        },
      ];

  for (let i = 0; i < (skin.extraTables?.length ?? 0); i++) {
    const ext = skin.extraTables![i];
    if (ext.branchSuffix) continue;
    scopes.push({
      kind: "table",
      id: `table:${i + 1}`,
      tableIdx: i + 1,
      label: ext.name || `Table ${i + 1}`,
    });
  }
  return scopes;
}

export function resolveScope(
  scopes: ComparatorScope[],
  scopeId: string,
): ComparatorScope | undefined {
  return scopes.find((s) => s.id === scopeId);
}

function metricsFromRows(headers: string[], rows: TableRow[]): string[] {
  const out: string[] = [];
  for (const h of headers) {
    const label = headerLabel(h);
    if (!label) continue;
    if (rows.some((row) => chartNumeric(row[h] ?? row[label]) != null)) {
      out.push(label);
    }
  }
  return out;
}

function metricsForScope(
  ctx: TowerCtx,
  skinName: string,
  scope: ComparatorScope,
): string[] {
  if (scope.kind === "table" || scope.kind === "linear") {
    const cfg =
      scope.kind === "table"
        ? ctx.active.orderedTables.find((t) => t.tableIdx === scope.tableIdx)
        : ctx.active.orderedTables[0];
    if (!cfg) return [];
    return metricsFromRows(cfg.headers, rowsFor(ctx, skinName, cfg));
  }

  const labels = new Set<string>();
  for (const cfg of ctx.active.orderedTables) {
    const b = (cfg.branchSuffix || ctx.trunk).toUpperCase();
    if (b !== ctx.trunk && b !== scope.letter) continue;
    for (const m of metricsFromRows(cfg.headers, rowsFor(ctx, skinName, cfg))) {
      labels.add(m);
    }
  }
  return [...labels];
}

export function listMetrics(
  tower: Tower,
  skinName: string,
  scope: ComparatorScope,
  rofInfo: RofInfo,
  modifier: GlobalModifier,
): string[] {
  const ctx = towerCtx(tower, skinName, rofInfo, modifier);
  if (!ctx) return [];
  return metricsForScope(ctx, skinName, scope);
}

export function pickDefaultMetric(
  metrics: string[],
  preferred?: string,
): string {
  if (preferred) {
    const want = preferred.toLowerCase();
    const hit = metrics.find((m) => m.toLowerCase() === want);
    if (hit) return hit;
  }
  return metrics[0] ?? "";
}

function metricValue(
  row: TableRow,
  headers: string[],
  metric: string,
): number | null {
  const want = metric.toLowerCase();
  for (const h of headers) {
    if (headerLabel(h).toLowerCase() === want) {
      return chartNumeric(row[h] ?? row[metric]);
    }
  }
  for (const [k, v] of Object.entries(row)) {
    if (headerLabel(k).toLowerCase() === want) return chartNumeric(v);
  }
  return null;
}

function pointX(
  xKey: ComparatorXKey,
  row: TableRow,
  level: number,
  addCost: number | null,
  cashRun: number,
): { x: number; nextCash: number } | null {
  if (xKey === X_LEVEL) return { x: level, nextCash: cashRun };
  if (xKey === X_COST) {
    if (addCost == null || !Number.isFinite(addCost)) return null;
    return { x: addCost, nextCash: cashRun };
  }
  const x = cashFromRow(row, addCost, cashRun);
  return { x, nextCash: x };
}

function indexByBranchLevel(
  ctx: TowerCtx,
  skinName: string,
): Map<string, { config: TableConfig; row: TableRow }> {
  const map = new Map<string, { config: TableConfig; row: TableRow }>();
  for (const cfg of ctx.active.orderedTables) {
    const branch = (cfg.branchSuffix || ctx.trunk).toUpperCase();
    const rows = rowsFor(ctx, skinName, cfg);
    for (let r = 0; r < rows.length; r++) {
      map.set(`${branch}|${rowLevel(rows[r], r)}`, {
        config: cfg,
        row: rows[r],
      });
    }
  }
  return map;
}

function pointsForScope(
  ctx: TowerCtx,
  skinName: string,
  scope: ComparatorScope,
  metric: string,
  xKey: ComparatorXKey,
): StatsChartPoint[] {
  if (!metric) return [];

  const points: StatsChartPoint[] = [];

  if (scope.kind === "table" || scope.kind === "linear") {
    const cfg =
      scope.kind === "table"
        ? ctx.active.orderedTables.find((t) => t.tableIdx === scope.tableIdx)
        : ctx.active.orderedTables[0];
    if (!cfg) return [];
    const rows = rowsFor(ctx, skinName, cfg);
    let run = 0;
    for (let i = 0; i < rows.length; i++) {
      const y = metricValue(rows[i], cfg.headers, metric);
      if (y == null) continue;
      const add = Number.isFinite(ctx.costs[i]) ? ctx.costs[i] : null;
      const px = pointX(xKey, rows[i], rowLevel(rows[i], i), add, run);
      if (!px) continue;
      run = px.nextCash;
      points.push({ x: px.x, y });
    }
    return points.sort((a, b) => a.x - b.x);
  }

  if (!ctx.schema?.length) return [];
  const byBL = indexByBranchLevel(ctx, skinName);
  let run = 0;
  for (let i = 0; i < ctx.schema.length; i++) {
    const { level, branch: raw } = schemaIndexToLevel(ctx.schema, i);
    const branch = (raw || ctx.trunk).toUpperCase();
    if (branch !== ctx.trunk && branch !== scope.letter) continue;
    const hit = byBL.get(`${branch}|${level}`);
    if (!hit) continue;
    const y = metricValue(hit.row, hit.config.headers, metric);
    if (y == null) continue;
    const add = Number.isFinite(ctx.costs[i]) ? ctx.costs[i] : null;
    const px = pointX(xKey, hit.row, level, add, run);
    if (!px) continue;
    run = px.nextCash;
    points.push({ x: px.x, y });
  }
  return points.sort((a, b) => a.x - b.x);
}

export function seriesLabel(
  towerName: string,
  scope: ComparatorScope,
  metric: string,
): string {
  if (scope.kind === "linear") return `${towerName} · ${metric}`;
  return `${towerName} · ${scope.label} · ${metric}`;
}

function yDomainFrom(yVals: number[]): [number, number] | undefined {
  if (!yVals.length) return undefined;
  const dataMin = Math.min(...yVals);
  const dataMax = Math.max(...yVals);
  let min = dataMin;
  let max = dataMax;
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
  }
  if (dataMin >= 0 && min < 0) min = 0;
  else if (dataMin > 0 && min / max < 0.15) min = 0;
  return [min, max];
}

export function buildComparatorChart(
  seriesDefs: {
    def: ComparatorSeriesDef;
    tower: Tower | null;
    displayName: string;
  }[],
  rofInfo: RofInfo,
  modifier: GlobalModifier,
  xKey: ComparatorXKey,
): {
  data: StatsChartPoint[];
  series: ComparatorSeriesResult[];
  rows: ComparatorSeriesRow[];
  xLabel: string;
  yDomain: [number, number] | undefined;
  hasPoints: boolean;
} {
  const memo: CtxMemo = new Map();
  const series: ComparatorSeriesResult[] = [];
  const rows: ComparatorSeriesRow[] = [];
  const yVals: number[] = [];
  const data: StatsChartPoint[] = [];

  for (let i = 0; i < seriesDefs.length; i++) {
    const { def, tower, displayName } = seriesDefs[i];
    const color = chartColorAt(i);

    if (!tower) {
      rows.push({ def, color, scopeItems: [], metricItems: [] });
      continue;
    }

    const scopes = listScopes(tower, def.skinName);
    const scopeItems = scopes.map((s) => ({ value: s.id, label: s.label }));
    const scope = resolveScope(scopes, def.scopeId);
    const ctx = getTowerCtx(memo, tower, def.skinName, rofInfo, modifier);

    let metrics: string[] = [];
    let points: StatsChartPoint[] = [];
    if (ctx && scope) {
      metrics = metricsForScope(ctx, def.skinName, scope);
      points = pointsForScope(ctx, def.skinName, scope, def.metric, xKey);
    }

    rows.push({
      def,
      color,
      scopeItems,
      metricItems: metrics.map((m) => ({ value: m, label: m })),
    });

    if (!scope) continue;
    for (const p of points) {
      yVals.push(p.y);
      data.push(p);
    }
    series.push({
      key: def.id,
      label: seriesLabel(displayName, scope, def.metric),
      color,
      value: "y",
      data: points,
    });
  }

  return {
    data,
    series,
    rows,
    xLabel: X_AXIS_OPTIONS.find((o) => o.key === xKey)?.label ?? "X",
    yDomain: yDomainFrom(yVals),
    hasPoints: data.length > 0,
  };
}

export function yRangeStep(auto: [number, number]): number {
  const span = Math.abs(auto[1] - auto[0]);
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / 100;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}

export function formatChartNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}
