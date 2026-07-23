import { mkCellKey, parseCellKey } from "$lib/neowtext/directives";
import { resolveToken, type TableCache } from "$lib/neowtext/functions";
import type { GlobalModifier } from "$lib/utils/globalModifier";
import {
  applyGlobalModifierToRow,
  applyGlobalModifierDisplay,
} from "$lib/utils/globalModifier";
import {
  applyRofBug,
  formatNumber,
  stripRefOnlyVarSuffix,
  stripRefs,
  toDisplayNumber,
} from "$lib/utils/format";
import type SkinData from "$lib/towerComponents/skinData";
import type Tower from "$lib/towerComponents/tower";

export type TableRow = Record<string, string | number>;
export type RefEntry = { content: string; name: string | null };

export interface TableConfig {
  skinName: string;
  tableIdx: number;
  sourceExtraTableIndex?: number;
  variantPrefix?: string;
  tableName: string;
  headers: string[];
  rawHeaders?: string[];
  rows: TableRow[];
  moneyColumns: string[];
  readOnlyColumns: string[];
  skinData: SkinData | null;
  formulaTokens?: Record<string, string>;
  cellFormulaTokens?: Record<string, Record<string, string>>;
  isPvp?: boolean;
  branchSuffix?: string;
  tableCache?: TableCache;
}

export type ActiveSkinTables = {
  skin: SkinData;
  orderedTables: TableConfig[];
};

export type RofInfo = {
  type: ReturnType<typeof import("$lib/utils/format").getRofBugVer>["type"];
  cols: Set<string>;
  enabled: boolean;
};

export type DeltaInfo = {
  delta: number | null;
  className: string;
  cellClass: string;
};

const INVERSE_STATS = new Set([
  "cooldown",
  "firerate",
  "cost",
  "total price",
  "cost efficiency",
  "price",
  "rev-up time",
  "bomb cooldown",
  "burn tick",
  "knife cooldown",
  "spawnrate",
  "deadzone range",
  "rocket firerate",
  "reload time",
  "spread",
  "recoil",
  "swingrate",
  "parry cooldown",
  "max cost efficiency",
  "spin time",
  "income per second",
  "income efficiency",
  "missile cooldown",
  "shield recharge speed",
  "tower selection cooldown",
  "charge time",
  "aim time",
  "cannon firerate",
  "build time",
  "tick",
  "base spread",
  "throw cooldown",
  "spool-up time",
  "min cost efficiency",
  "lowest firerate",
  "highest firerate",
  "aftershock delay",
  "confusion cooldown",
  "missle reload",
  "charge-up",
]);

export function tableCacheKey(skinName: string, tableIdx: number): string {
  return `${skinName}:${tableIdx}`;
}

function formulaTokens(config: TableConfig): Record<string, string> {
  return config.skinData?.formulaTokens ?? config.formulaTokens ?? {};
}

function cellFormulaTokens(
  config: TableConfig,
): Record<string, Record<string, string>> | undefined {
  return config.skinData?.cellFormulaTokens ?? config.cellFormulaTokens;
}

export function buildActiveSkinTables(
  tower: Tower | null,
  skinName: string,
): ActiveSkinTables | null {
  if (!tower) return null;
  const skin = tower.getSkin(skinName);
  if (!skin) return null;

  const primary = buildTableConfigForSkin(tower, skinName, 0, -1);
  if (!primary) return null;

  const orderedTables = [
    primary,
    ...(skin.extraTables?.map((_, i) =>
      buildTableConfigForSkin(tower, skinName, i + 1, i),
    ) ?? []),
  ].filter((v): v is TableConfig => v !== null);

  const primaryIdx = Number.isFinite(skin.primaryTableIndex)
    ? Math.max(0, skin.primaryTableIndex)
    : 0;
  if (primaryIdx > 0 && primaryIdx < orderedTables.length) {
    const [primaryTable] = orderedTables.splice(0, 1);
    orderedTables.splice(primaryIdx, 0, primaryTable);
  }

  return { skin, orderedTables };
}

export function buildTableConfigForSkin(
  tower: Tower,
  skinName: string,
  tableIdx: number,
  sourceExtraTableIndex: number,
): TableConfig | null {
  const skin = tower.getSkin(skinName);
  if (!skin) return null;

  if (tableIdx === 0) {
    const headers =
      skin.headers.length > 0 ? skin.headers : skin.levels.attributes;
    const rawHeaders =
      skin.rawHeaders?.length === headers.length ? skin.rawHeaders : headers;
    return {
      skinName,
      tableIdx,
      sourceExtraTableIndex: -1,
      variantPrefix: skin.variantPrefix,
      tableName: skin.tableName,
      headers,
      rawHeaders,
      rows: skin.levels.levels.slice(0, skin.rawRows.length),
      moneyColumns: skin.moneyColumns,
      readOnlyColumns: [],
      skinData: skin,
      branchSuffix: undefined,
      tableCache: skin.tableCache,
    };
  }

  const extra = skin.extraTables?.[sourceExtraTableIndex];
  if (!extra) return null;
  return {
    skinName,
    tableIdx,
    sourceExtraTableIndex,
    variantPrefix: skin.variantPrefix,
    tableName: extra.name,
    headers: extra.headers,
    rawHeaders: extra.rawHeaders,
    rows: [...extra.rows],
    moneyColumns: extra.moneyColumns,
    readOnlyColumns: extra.readOnlyColumns,
    skinData: null,
    cellFormulaTokens: extra.cellFormulaTokens,
    formulaTokens: skin.formulaTokens,
    isPvp: skin.isPvp,
    branchSuffix: extra.branchSuffix,
    tableCache: skin.tableCache,
  };
}

export function buildDisplayRows(
  config: TableConfig,
  rofInfo: RofInfo,
  globalModifier: GlobalModifier,
  applyDisplayRofBug = true,
  applyGlobalModifier = true,
): TableRow[] {
  if (config.rows.length === 0) return [];

  const keyMap = new Map<string, string>();
  for (const k of Object.keys(config.rows[0])) keyMap.set(k, stripRefs(k));

  return config.rows.map((r, rowIdx) => {
    const cleanRow: TableRow = {};

    for (const [k, v] of Object.entries(r)) {
      const ck = keyMap.get(k)!;
      if (applyDisplayRofBug && rofInfo.enabled && rofInfo.cols.has(ck)) {
        const n = Number(v);
        cleanRow[ck] = !isNaN(n) && n !== 0 ? applyRofBug(n, rofInfo.type) : v;
      } else {
        cleanRow[ck] = v;
      }
    }

    const tokens = cellFormulaTokens(config)?.[String(rowIdx)];
    const evalContext = applyGlobalModifier
      ? applyGlobalModifierToRow(globalModifier, cleanRow)
      : cleanRow;

    if (tokens) {
      for (let pass = 0; pass < 2; pass++) {
        for (const [col, tok] of Object.entries(tokens)) {
          if (!tok.trim()) continue;
          const levelVal =
            cleanRow.Level !== undefined
              ? String(cleanRow.Level) + (config.branchSuffix || "")
              : String(rowIdx) + (config.branchSuffix || "");
          const res = resolveToken(
            tok,
            levelVal,
            evalContext,
            formulaTokens(config),
            config.skinData?.isPvp ?? config.isPvp ?? false,
            0,
            config.skinData?.tableCache ?? config.tableCache,
            applyDisplayRofBug,
            false,
            undefined,
            undefined,
            config.variantPrefix,
          );
          if (res != null) {
            const colKey = stripRefs(col);
            cleanRow[colKey] = res;
            evalContext[colKey] = res;
          }
        }
      }
    }

    const outRow = { ...r };
    for (const k of Object.keys(r))
      outRow[k] = cleanRow[keyMap.get(k)!] ?? r[k];
    return outRow;
  });
}

export function buildCompareRowsCache(
  tower: Tower | null,
  rofInfo: RofInfo,
  globalModifier: GlobalModifier,
): Map<string, TableRow[]> {
  const cache = new Map<string, TableRow[]>();
  if (!tower) return cache;
  for (const skinName of tower.skinNames) {
    const skin = tower.getSkin(skinName);
    if (!skin) continue;
    for (
      let tableIdx = 0;
      tableIdx <= (skin.extraTables?.length ?? 0);
      tableIdx++
    ) {
      const config = buildTableConfigForSkin(
        tower,
        skinName,
        tableIdx,
        tableIdx - 1,
      );
      if (config?.rows.length) {
        cache.set(
          tableCacheKey(skinName, tableIdx),
          buildDisplayRows(config, rofInfo, globalModifier, false, false),
        );
      }
    }
  }
  return cache;
}

export function buildDisplayRowsCache(
  data: ActiveSkinTables | null,
  skinName: string,
  rofInfo: RofInfo,
  globalModifier: GlobalModifier,
): Map<string, TableRow[]> {
  const cache = new Map<string, TableRow[]>();
  if (!data) return cache;
  for (const config of data.orderedTables) {
    if (config.rows.length) {
      cache.set(
        tableCacheKey(skinName, config.tableIdx),
        buildDisplayRows(config, rofInfo, globalModifier),
      );
    }
  }
  return cache;
}

function getCellFormulaToken(
  config: TableConfig,
  rowIdx: number,
  header: string,
): string | undefined {
  const tokens = cellFormulaTokens(config)?.[String(rowIdx)] ?? {};
  let cellTok = tokens[header] ?? tokens[stripRefs(header)];
  if (!cellTok) {
    for (const [k, v] of Object.entries(tokens)) {
      if (stripRefs(k) === stripRefs(header)) {
        cellTok = v;
        break;
      }
    }
  }
  return typeof cellTok === "string" ? cellTok : undefined;
}

export function getEditableCellRawValue(
  config: TableConfig,
  rowIdx: number,
  header: string,
): string | number | undefined {
  const formula = getCellFormulaToken(config, rowIdx, header);
  if (formula) return formula;
  return config.rows[rowIdx]?.[header];
}

export function cellDisplaySource(
  value: unknown,
  formula: string | number | undefined,
  tokens: Record<string, string>,
): string | number | null | undefined {
  if (value === undefined || value === null) return value;

  // row holds head only with formula keeping mid-string $VAR$ and <ref> for CellRefs
  if (typeof formula === "string" && /<ref\b|\$[A-Z0-9_-]+\$/i.test(formula)) {
    const n =
      typeof value === "number"
        ? formatNumber(value)
        : typeof value === "string" && /^(N\/A|-?[\d.,]+)$/i.test(value.trim())
          ? value.trim()
          : null;
    if (n == null) return value as string | number;
    if (/^(N\/A|-?[\d.,]+)/i.test(formula))
      return formula.replace(/^(N\/A|-?[\d.,]+)/i, n);

    let used = false;
    return formula.replace(
      /<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>|\$[A-Z0-9_-]+\$/gi,
      (m) => {
        if (m[0] === "<") return m;
        const def = tokens[m];
        if (
          typeof def === "string" &&
          /<ref\b/i.test(def) &&
          !stripRefs(def).trim()
        )
          return m;
        if (!used) {
          used = true;
          return n;
        }
        return "";
      },
    );
  }

  if (typeof value === "string" && /<ref\b|\$[A-Z0-9_-]+\$/i.test(value))
    return value;

  return value as string | number;
}

export function displayCellValue(
  globalModifier: GlobalModifier,
  header: string,
  value: unknown,
  formulaTokens: Record<string, string> = {},
) {
  if (value === undefined || value === null) return value;
  // so that footnote doesn't snap to end
  if (typeof value === "string" && /<ref\b|\$[A-Z0-9_-]+\$/i.test(value)) {
    return value;
  }
  const raw =
    typeof value === "string" || typeof value === "number"
      ? stripRefOnlyVarSuffix(value, formulaTokens)
      : undefined;
  return applyGlobalModifierDisplay(globalModifier, header, raw);
}

export function formatDelta(delta: number): string {
  return `${delta > 0 ? "+" : ""}${formatNumber(delta)}`;
}

function getDeltaClasses(header: string, delta: number) {
  if (delta === 0) return { text: "", cell: "" };
  const inv = INVERSE_STATS.has(stripRefs(header).trim().toLowerCase());
  const isGood = inv ? delta < 0 : delta > 0;
  return {
    text: isGood ? "text-green-500" : "text-red-500",
    cell: isGood ? "diff-positive" : "diff-negative",
  };
}

export function getDeltaForCell(
  baseline: Record<string, unknown>,
  currentValue: string | number | undefined,
  skinName: string,
  tableIdx: number,
  levelIndex: number,
  header: string,
  cellReadOnly: boolean,
): DeltaInfo {
  const baseN = toDisplayNumber(
    baseline[mkCellKey(skinName, tableIdx, levelIndex, header)],
    cellReadOnly,
  );
  const currentN = toDisplayNumber(currentValue, cellReadOnly);

  if (baseN == null || currentN == null)
    return { delta: null, className: "", cellClass: "" };

  const delta = currentN - baseN;
  const classes = getDeltaClasses(header, delta);
  return {
    delta: Math.abs(delta) < 1e-9 ? 0 : delta,
    className: classes.text,
    cellClass: classes.cell,
  };
}

export function isCellEditable(config: TableConfig, header: string): boolean {
  const clean = stripRefs(header);
  return config.skinData
    ? !config.skinData.readOnlyAttributes.includes(clean) &&
        (clean !== "Cost" || config.skinData.locator.hasLocation(header))
    : !config.readOnlyColumns.includes(clean);
}

export function extractRefEntries(
  s1: string,
  s2: string,
  tokens: Record<string, string>,
  refTokenRegistry?: RefTokenRegistry,
): RefEntry[] {
  const sources = [s1, s2].filter(Boolean) as string[];
  const entries: RefEntry[] = [];
  const refRe = /<ref\b([^>]*)>([\s\S]*?)<\/ref>|<ref\b([^>]*)\/>/gi;
  const tokRe = /\$[A-Z0-9_-]+\$/g;
  const seen = new Set<string>();
  const add = (content: string, name: string | null) => {
    const t = content.trim();
    if (!t) return;
    const key = refEntryKey(t, name);
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({ content: t, name });
    }
  };

  function handleSrc(src: string) {
    let m: RegExpExecArray | null;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(src)) !== null) {
      const attrs = m[1] || m[3] || "";
      const content = m[2];
      const name = attrs.match(/name\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? null;
      if (content !== undefined) add(content, name);
      else if (name) {
        const grouped = refTokenRegistry?.byName.get(name);
        if (grouped) add(grouped.content, name);
        else {
          for (const def of Object.values(tokens)) {
            if (typeof def !== "string") continue;
            if (
              def.match(/<ref\b[^>]*name\s*=\s*["']?([^"'\s>]+)/i)?.[1] !== name
            )
              continue;
            const cm = def.match(/<ref\b[^>]*>([\s\S]*?)<\/ref>/i);
            if (cm) add(cm[1], name);
            break;
          }
        }
      }
    }
  }

  for (const src of sources) {
    handleSrc(src);
    tokRe.lastIndex = 0;
    let t: RegExpExecArray | null;
    while ((t = tokRe.exec(src)) !== null) {
      const tok = t[0];
      const def = tokens[tok];
      if (typeof def !== "string" || !parseRefDef(def)) continue;
      const grouped = refTokenRegistry?.byToken.get(tok);
      if (grouped) add(grouped.content, grouped.name);
      else handleSrc(def);
    }
  }

  return entries;
}

export type RefTokenMeta = { name: string; content: string };

export type RefTokenRegistry = {
  byToken: Map<string, RefTokenMeta>;
  byName: Map<string, RefTokenMeta>;
};

const EMPTY_REF_REGISTRY: RefTokenRegistry = {
  byToken: new Map(),
  byName: new Map(),
};

const TOK_RE = /\$[A-Z0-9_-]+\$/g;

function parseRefDef(val: string): { attrs: string; content: string } | null {
  const m = val.trim().match(/^<ref\s*([^>]*)>([\s\S]*?)<\/ref>\s*$/i);
  if (!m) return null;
  return { attrs: m[1], content: m[2] };
}

function refNameFromToken(tok: string, attrs: string): string {
  const existing = attrs.match(/name\s*=\s*["']?([^"'\s>]+)/i)?.[1];
  if (existing) return existing;
  return tok
    .replace(/^\$|\$$/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function forEachSkinRefSource(
  activeSkin: ActiveSkinTables | null,
  displayRowsCache: Map<string, TableRow[]>,
  fn: (
    src: string,
    config: TableConfig,
    rowIdx: number,
    tokens: Record<string, string>,
  ) => void,
): void {
  if (!activeSkin) return;

  for (const config of activeSkin.orderedTables) {
    const tokens = formulaTokens(config);
    const cft = cellFormulaTokens(config) ?? {};
    const displayRows =
      displayRowsCache.get(tableCacheKey(config.skinName, config.tableIdx)) ??
      [];

    const register = (src: unknown, rowIdx: number) => {
      const s = typeof src === "string" ? src : "";
      if (!s.includes("<ref") && !/\$[A-Z]/.test(s)) return;
      fn(s, config, rowIdx, tokens);
    };

    register(config.tableName, 0);

    for (let i = 0; i < config.headers.length; i++) {
      register(config.rawHeaders?.[i] ?? config.headers[i], 0);
    }

    for (let r = 0; r < displayRows.length; r++) {
      const row = displayRows[r];
      for (const h of config.headers) {
        register(cft[String(r)]?.[h] ?? cft[String(r)]?.[stripRefs(h)], r);
        const rv = row[h];
        if (typeof rv === "string" && rv.includes("<ref")) register(rv, r);
      }
    }
  }
}

export function resolveRefContent(
  content: string,
  config: TableConfig,
  rowIdx: number,
  displayRow: TableRow,
  globalModifier: GlobalModifier = { entries: [] },
): string {
  const row: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(displayRow)) {
    if (v !== undefined && v !== null) row[stripRefs(k)] = v;
  }
  const evalContext = applyGlobalModifierToRow(globalModifier, row);
  const levelVal =
    row.Level !== undefined
      ? String(row.Level) + (config.branchSuffix || "")
      : String(rowIdx) + (config.branchSuffix || "");

  const resolved = resolveToken(
    content,
    levelVal,
    evalContext,
    formulaTokens(config),
    config.skinData?.isPvp ?? config.isPvp ?? false,
    0,
    config.skinData?.tableCache ?? config.tableCache,
    false,
    false,
    undefined,
    undefined,
    config.variantPrefix,
  );

  return resolved !== undefined ? String(resolved) : content;
}

type RefSource = {
  src: string;
  config: TableConfig;
  rowIdx: number;
  tokens: Record<string, string>;
};

function collectSkinRefSources(
  activeSkin: ActiveSkinTables,
  displayRowsCache: Map<string, TableRow[]>,
): RefSource[] {
  const sources: RefSource[] = [];
  forEachSkinRefSource(
    activeSkin,
    displayRowsCache,
    (src, config, rowIdx, tokens) => {
      sources.push({ src, config, rowIdx, tokens });
    },
  );
  return sources;
}

function buildRefTokenRegistry(
  activeSkin: ActiveSkinTables,
  sources: RefSource[],
): RefTokenRegistry {
  const vars = formulaTokens(activeSkin.orderedTables[0]);
  const counts = new Map<string, number>();

  for (const { src } of sources) {
    TOK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOK_RE.exec(src)) !== null) {
      const tok = m[0];
      if (parseRefDef(vars[tok] ?? "")) {
        counts.set(tok, (counts.get(tok) ?? 0) + 1);
      }
    }
  }

  const byToken = new Map<string, RefTokenMeta>();
  const byName = new Map<string, RefTokenMeta>();

  for (const [tok, count] of counts) {
    if (count <= 1) continue;
    const parsed = parseRefDef(vars[tok] ?? "");
    if (!parsed) continue;
    const meta = {
      name: refNameFromToken(tok, parsed.attrs),
      content: parsed.content.trim(),
    };
    byToken.set(tok, meta);
    byName.set(meta.name, meta);
  }

  return { byToken, byName };
}

export type SkinNote = { num: number; entry: RefEntry };

export type SkinRefState = {
  registry: RefTokenRegistry;
  notes: SkinNote[];
  refNumberMap: Map<string, number>;
};

export function buildSkinRefState(
  activeSkin: ActiveSkinTables | null,
  displayRowsCache: Map<string, TableRow[]>,
  globalModifier: GlobalModifier = { entries: [] },
): SkinRefState {
  if (!activeSkin?.orderedTables.length) {
    return { registry: EMPTY_REF_REGISTRY, notes: [], refNumberMap: new Map() };
  }

  const sources = collectSkinRefSources(activeSkin, displayRowsCache);
  const registry = buildRefTokenRegistry(activeSkin, sources);
  const notes: SkinNote[] = [];
  const refNumberMap = new Map<string, number>();
  let next = 1;

  for (const { src, config, rowIdx, tokens } of sources) {
    const displayRows =
      displayRowsCache.get(tableCacheKey(config.skinName, config.tableIdx)) ??
      [];
    const displayRow = displayRows[rowIdx] ?? displayRows[0] ?? {};

    for (const entry of getRefsFromSources(
      src,
      "",
      config,
      rowIdx,
      displayRow,
      globalModifier,
      tokens,
      registry,
    )) {
      const key = refEntryKey(entry.content, entry.name);
      if (refNumberMap.has(key)) continue;
      refNumberMap.set(key, next);
      notes.push({ num: next++, entry });
    }
  }

  return { registry, notes, refNumberMap };
}

export function getRefsFromSources(
  s1: string,
  s2: string,
  config: TableConfig,
  rowIdx: number,
  displayRow: TableRow,
  globalModifier: GlobalModifier,
  tokens?: Record<string, string>,
  refTokenRegistry?: RefTokenRegistry,
): RefEntry[] {
  return extractRefEntries(
    s1,
    s2,
    tokens ?? formulaTokens(config),
    refTokenRegistry,
  ).map((entry) => ({
    content: resolveRefContent(
      entry.content,
      config,
      rowIdx,
      displayRow,
      globalModifier,
    ),
    name: entry.name,
  }));
}

export function refEntryKey(content: string, name?: string | null): string {
  return name ? `n:${name}` : `c:${content.trim()}`;
}

export function getCompareValueForKey(
  compareRowsCache: Map<string, TableRow[]>,
  key: string,
): string | number | undefined {
  const parsed = parseCellKey(key);
  if (!parsed) return undefined;
  const row = compareRowsCache.get(
    tableCacheKey(parsed.skin, parsed.tableIdx),
  )?.[parsed.rowIdx];
  if (!row) return undefined;
  return parsed.header === "Level" ? parsed.rowIdx : row[parsed.header];
}
