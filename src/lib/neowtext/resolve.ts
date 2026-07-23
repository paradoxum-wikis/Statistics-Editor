import { evaluateFormula } from "$lib/neowtext/evaluator";
import {
  parseNumeric,
  stripRefs,
  formatReadOnly,
  getRofBugVer,
  applyRofBug,
  normalizeColumnKey,
  columnKeysEqual,
} from "$lib/utils/format";
import { settingsStore } from "$lib/stores/settings.svelte";
import {
  getTableCacheRowAt,
  type TableRowCache,
} from "$lib/neowtext/tableCache";
import { resolveFNC } from "$lib/neowtext/functions/total";
import {
  buildBranchMap,
  parseLevelBranch,
  parseLevelNumber,
  resolveBranchSpec,
} from "$lib/neowtext/functions/schema";

export type TableCache = Record<string, TableRowCache>;

function getCachedTableRow(
  tableCache: TableCache | undefined,
  tableName: string,
  level: number,
  branch?: string,
): Record<string, string | number> | undefined {
  if (!tableCache) return undefined;

  const raw = stripRefs(tableName).trim();
  const noSpace = raw.replace(/\s+/g, "");
  const keys = [tableName.trim(), raw, noSpace];

  for (const key of keys) {
    const row = getTableCacheRowAt(tableCache[key], level, branch);
    if (row) return row;
  }
  return undefined;
}

function getCachedColumnValue(
  row: Record<string, string | number>,
  columnName: string,
): string | number | undefined {
  const norm = normalizeColumnKey(columnName);
  const noSpace = norm.replace(/\s+/g, "");

  if (row[columnName.trim()] !== undefined) return row[columnName.trim()];
  if (row[norm] !== undefined) return row[norm];
  if (row[noSpace] !== undefined) return row[noSpace];

  for (const [k, v] of Object.entries(row)) {
    if (columnKeysEqual(k, columnName)) return v;
  }
  return undefined;
}

function maybeApplyRofToCachedRow(
  row: Record<string, string | number>,
  tokens: Record<string, string>,
  applyRofToCache: boolean,
): Record<string, string | number> {
  if (!applyRofToCache) return row;

  const rofInfo = getRofBugVer(tokens);
  if (rofInfo.cols.length === 0) return row;

  const rofCols = new Set(rofInfo.cols.map((c) => stripRefs(c).trim()));
  const adjusted: Record<string, string | number> = {};

  for (const [k, v] of Object.entries(row)) {
    const cleanK = stripRefs(k).trim();
    if (rofCols.has(cleanK)) {
      const n = Number(v);
      adjusted[k] = !isNaN(n) && n !== 0 ? applyRofBug(n, rofInfo.type) : v;
    } else {
      adjusted[k] = v;
    }
  }

  return adjusted;
}

function splitTopLevelPipes(input: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;

  for (let i = 0; i < input.length; i++) {
    const two = input.slice(i, i + 2);
    if (two === "{{") {
      depth++;
      i++;
      continue;
    }
    if (two === "}}") {
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (input[i] === "|" && depth === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(input.slice(start));
  return parts;
}

function findTemplateEnd(input: string, start: number): number {
  let depth = 0;
  for (let i = start; i < input.length - 1; i++) {
    const two = input.slice(i, i + 2);
    if (two === "{{") {
      depth++;
      i++;
      continue;
    }
    if (two === "}}") {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function normalizeFormatnumModifier(
  s: string,
): "rawsuffix" | "nocommafysuffix" | "lossless" | null {
  const m = s.trim().toLowerCase();
  if (!m) return null;
  if (m === "r" || m === "raw" || m === "rawsuffix") return "rawsuffix";
  if (m === "nosep" || m === "nocommafysuffix") return "nocommafysuffix";
  if (m === "lossless") return "lossless";
  return null;
}

function parseFormattedNumberLike(input: string): string {
  const s = stripRefs(input).trim();
  if (!s) return "";

  let cleaned = s.replace(/[\u00A0\u202F\s]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    cleaned = cleaned.replace(/,/g, ".");
  }

  cleaned = cleaned.replace(/[^0-9+\-.eE]/g, "");
  return cleaned;
}

function formatNumberLike(input: string, useGrouping: boolean): string {
  const parsed = parseFormattedNumberLike(input);
  const n = Number(parsed);
  if (!Number.isFinite(n)) return stripRefs(input).trim();

  return n.toLocaleString("en-US", {
    useGrouping,
    maximumFractionDigits: 20,
  });
}

/**
 * Resolves a token ($FNC-NAME$ / $FSE-NAME$, $nVar$, or $Var$) to a value,
 * recursing through token aliases when a $Var$ points to another token.
 */
export function resolveToken(
  token: string,
  level: number | string,
  row: Record<string, string | number>,
  tokens: Record<string, string>,
  isPvp: boolean,
  depth = 0,
  tableCache?: TableCache,
  applyRofToCache: boolean = false,
  levelLocked: boolean = false,
  branchOverride?: string,
  branchMap?: Record<string, string>,
  variantPrefix?: string,
): string | number | undefined {
  token = stripRefs(token).trim();
  if (depth > 10) return undefined;

  const activeBranch = branchOverride || parseLevelBranch(level);
  let cachedBranchMap = branchMap;
  const getBranchMap = (): Record<string, string> =>
    (cachedBranchMap ??= buildBranchMap(tokens, variantPrefix));

  // $TOKEN@N@Branch$
  const levelAndBranchPinMatch = token.match(/^\$(.+)@(\d+)@([^$]+)\$$/);
  if (levelAndBranchPinMatch) {
    const [, inner, pinLevel, branchSpec] = levelAndBranchPinMatch;
    const pinnedLevel = levelLocked ? level : Number(pinLevel);
    const pinnedBranch = resolveBranchSpec(branchSpec, getBranchMap());
    return resolveToken(
      `$${inner}$`,
      pinnedLevel,
      row,
      tokens,
      isPvp,
      depth + 1,
      tableCache,
      applyRofToCache,
      true,
      pinnedBranch,
      cachedBranchMap,
      variantPrefix,
    );
  }

  // $TOKEN@N$
  const levelPinMatch = token.match(/^\$(.+)@(\d+)\$$/);
  if (levelPinMatch) {
    const [, inner, pinLevel] = levelPinMatch;
    const pinnedLevel = levelLocked ? level : Number(pinLevel);
    return resolveToken(
      `$${inner}$`,
      pinnedLevel,
      row,
      tokens,
      isPvp,
      depth + 1,
      tableCache,
      applyRofToCache,
      true,
      activeBranch,
      cachedBranchMap,
      variantPrefix,
    );
  }

  if (
    /\$[^$]+\$/.test(token) &&
    !/^\$[^$]+\$$/.test(token) &&
    !/^{{#expr:.*}}$/i.test(token)
  ) {
    return token.replace(/\$[^$]+\$/g, (match) => {
      const resolved = resolveToken(
        match,
        level,
        row,
        tokens,
        isPvp,
        depth + 1,
        tableCache,
        applyRofToCache,
        levelLocked,
        activeBranch,
        cachedBranchMap,
        variantPrefix,
      );

      if (typeof resolved === "number") {
        return formatReadOnly(resolved);
      }
      return resolved !== undefined ? String(resolved) : match;
    });
  }

  const totalMatch = token.match(
    /^\$FNC-(TOTALPRICE|TOTAL-[A-Z0-9]+(?:-[A-Z0-9]+)*)\$$/i,
  );
  if (totalMatch) {
    return resolveFNC(
      totalMatch[1],
      level,
      tokens,
      isPvp,
      activeBranch,
      cachedBranchMap,
      variantPrefix,
      row,
      tableCache,
      applyRofToCache,
      depth,
    );
  }

  // $Table.Column$
  const dotTokenMatch = token.match(/^\$(.+?)\.([^.$]+)\$$/);
  if (dotTokenMatch) {
    const [, tableNameRaw, columnNameRaw] = dotTokenMatch;
    const numLevel = parseLevelNumber(level);
    const tableName = tableNameRaw.trim();
    const columnName = columnNameRaw.trim();
    const cached = getCachedTableRow(
      tableCache,
      tableName,
      numLevel,
      activeBranch,
    );

    if (cached) {
      const cacheContext = maybeApplyRofToCachedRow(
        cached,
        tokens,
        applyRofToCache,
      );
      const cachedVal = getCachedColumnValue(cacheContext, columnName);

      if (cachedVal !== undefined) {
        const resolved = resolveToken(
          String(cachedVal),
          level,
          cacheContext,
          tokens,
          isPvp,
          depth + 1,
          tableCache,
          applyRofToCache,
          levelLocked,
          activeBranch,
          cachedBranchMap,
          variantPrefix,
        );
        return resolved !== undefined ? resolved : stripRefs(String(cachedVal));
      }
    }

    return undefined;
  }

  // #expr, {{formatnum:...}} or $Var$
  const isExpr = /^{{#expr:.*}}$/i.test(token);
  const isFormatNum = /^{{\s*formatnum\s*:[\s\S]*}}$/i.test(token);
  const isVar = token.startsWith("$") && tokens[token] !== undefined;

  if (isExpr || isVar || isFormatNum) {
    let val = isVar ? tokens[token] : token;
    if (isVar && /<ref\b/i.test(val) && !stripRefs(val).trim()) return val;

    let hadFormatnum = false;

    const resolveSingleFormatnum = (call: string): string | null => {
      const trimmed = call.trim();
      if (!/^{{\s*formatnum\s*:/i.test(trimmed) || !trimmed.endsWith("}}")) {
        return null;
      }

      const body = trimmed.slice(2, -2);
      const m = body.match(/^\s*formatnum\s*:\s*([\s\S]*)$/i);
      if (!m) return null;

      const parts = splitTopLevelPipes(m[1]);
      const numPart = parts[0] ?? "";
      const mod1 = normalizeFormatnumModifier(parts[1] ?? "");
      const mod2 = normalizeFormatnumModifier(parts[2] ?? "");
      const modifiers = new Set([mod1, mod2].filter(Boolean));

      const resolvedNum = resolveToken(
        numPart.trim(),
        level,
        row,
        tokens,
        isPvp,
        depth + 1,
        tableCache,
        applyRofToCache,
        levelLocked,
        activeBranch,
        cachedBranchMap,
        variantPrefix,
      );

      const numStr =
        resolvedNum !== undefined ? String(resolvedNum).trim() : numPart.trim();

      if (modifiers.has("rawsuffix")) {
        hadFormatnum = true;
        return parseFormattedNumberLike(numStr);
      }

      const potentiallyLossy = modifiers.has("nocommafysuffix")
        ? formatNumberLike(numStr, false)
        : formatNumberLike(numStr, true);

      if (modifiers.has("lossless")) {
        hadFormatnum = true;
        return parseFormattedNumberLike(potentiallyLossy) === numStr
          ? potentiallyLossy
          : numStr;
      }

      hadFormatnum = true;
      return potentiallyLossy;
    };

    const resolveFormatnumTemplates = (input: string): string => {
      let out = input;

      for (let pass = 0; pass < 20; pass++) {
        let changed = false;

        for (let i = 0; i < out.length - 1; i++) {
          if (out[i] !== "{" || out[i + 1] !== "{") continue;

          const slice = out.slice(i);
          if (!/^{{\s*formatnum\s*:/i.test(slice)) continue;

          const end = findTemplateEnd(out, i);
          if (end < 0) continue;

          const call = out.slice(i, end);
          const replacement = resolveSingleFormatnum(call);
          if (replacement === null) continue;

          out = out.slice(0, i) + replacement + out.slice(end);
          changed = true;
          i += replacement.length - 1;
        }

        if (!changed) break;
      }

      return out;
    };

    if (isVar && /^\$[^$]+\$$/.test(val)) {
      return resolveToken(
        val,
        level,
        row,
        tokens,
        isPvp,
        depth + 1,
        tableCache,
        applyRofToCache,
        levelLocked,
        activeBranch,
        cachedBranchMap,
        variantPrefix,
      );
    }

    val = val.replace(/\$[^$]+\$/g, (match) => {
      const resolved = resolveToken(
        match,
        level,
        row,
        tokens,
        isPvp,
        depth + 1,
        tableCache,
        applyRofToCache,
        levelLocked,
        activeBranch,
        cachedBranchMap,
        variantPrefix,
      );
      return resolved !== undefined ? String(resolved) : "0";
    });

    const context = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [stripRefs(k), v]),
    );

    const numLevel = parseLevelNumber(level);
    val = val.replace(/^["'](.*)["']$/, "$1");

    val = val.replace(
      /([a-zA-Z_][a-zA-Z0-9_ ]*)\.([a-zA-Z_][a-zA-Z0-9_ ]*)/g,
      (match, tname, col) => {
        const tableName = tname.trim();
        const columnName = col.trim();
        const cached = getCachedTableRow(
          tableCache,
          tableName,
          numLevel,
          activeBranch,
        );
        const cacheContext = cached
          ? maybeApplyRofToCachedRow(cached, tokens, applyRofToCache)
          : undefined;
        const cachedVal = cacheContext
          ? getCachedColumnValue(cacheContext, columnName)
          : undefined;

        if (settingsStore.debugMode) {
          console.log("[resolveToken] cross-table lookup", {
            token,
            level,
            numLevel,
            activeBranch,
            tableName,
            columnName,
            cacheHit: cached !== undefined,
            cachedValue: cachedVal,
            applyRofToCache,
          });
        }

        if (cachedVal !== undefined && cacheContext) {
          if (settingsStore.debugMode) {
            console.log("[resolveToken] cross-table cache row", {
              tableName,
              columnName,
              rawCached: cached,
              cleanCached: cacheContext,
            });
          }

          const resolved = resolveToken(
            String(cachedVal),
            level,
            cacheContext,
            tokens,
            isPvp,
            depth + 1,
            tableCache,
            applyRofToCache,
            levelLocked,
            activeBranch,
            cachedBranchMap,
            variantPrefix,
          );

          if (settingsStore.debugMode) {
            console.log("[resolveToken] cross-table resolved", {
              tableName,
              columnName,
              cachedValue: cachedVal,
              resolved,
            });
          }

          return resolved !== undefined
            ? String(resolved)
            : stripRefs(String(cachedVal));
        }

        if (settingsStore.debugMode) {
          console.log("[resolveToken] cross-table miss", {
            token,
            level,
            numLevel,
            tableName,
            columnName,
          });
        }

        return match;
      },
    );

    val = resolveFormatnumTemplates(val);

    if (
      hadFormatnum &&
      !/^{{#expr:.*}}$/i.test(val) &&
      !/\$[^$]+\$/.test(val)
    ) {
      return val;
    }

    if (!isExpr) {
      if (val.includes("**") || val.includes("%")) {
        // **
        val = val.replace(/\*\*/g, "^");
        // %
        val = val.replace(
          /([0-9A-Za-z_\)\]])\s*%\s*([0-9A-Za-z_\(\[])/g,
          "$1 fmod $2",
        );
      }
    }

    const result = evaluateFormula(val, context);
    // fragment var expansion
    if (!Number.isNaN(result)) return result;
    return val;
  }

  return undefined;
}
