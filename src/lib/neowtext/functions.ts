import { evaluateFormula } from "$lib/neowtext/evaluator";
import {
  parseNumeric,
  stripRefs,
  formatReadOnly,
  getRofBugVer,
  applyRofBug,
} from "$lib/utils/format";
import { settingsStore } from "$lib/stores/settings.svelte";

function parseLevelNumber(level: number | string): number {
  const parsed = typeof level === "number" ? level : parseInt(level, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLevelBranch(level: number | string): string {
  if (typeof level !== "string") return "";
  return level.match(/[A-Za-z]+$/)?.[0] ?? "";
}

function buildBranchMap(
  tokens: Record<string, string>,
  isPvp: boolean,
): Record<string, string> {
  const schemaStr = tokens["$FNC-SCHEMA$"];
  if (!schemaStr) return {};

  const schema = schemaStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const trunkLetter = schema[0] || "N";

  const seen = new Set<string>();
  const branchLetters: string[] = [];
  for (const letter of schema) {
    if (letter !== trunkLetter && !seen.has(letter)) {
      seen.add(letter);
      branchLetters.push(letter);
    }
  }

  const branchKey =
    isPvp && tokens["$FNC-PVP-BRANCH$"] ? "$FNC-PVP-BRANCH$" : "$FNC-BRANCH$";

  const branchMap: Record<string, string> = {};
  const branchNames = (tokens[branchKey] || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  branchNames.forEach((name, i) => {
    const letter = branchLetters[i];
    if (!letter) return;
    branchMap[name] = letter;
    branchMap[name.replace(/\s+/g, "")] = letter;
  });

  return branchMap;
}

function resolveBranchSpec(
  branchSpec: string,
  branchMap: Record<string, string>,
): string {
  const clean = stripRefs(branchSpec).trim();
  if (!clean) return "";
  return branchMap[clean] ?? branchMap[clean.replace(/\s+/g, "")] ?? clean;
}

function getCachedTableRow(
  tableCache: TableCache | undefined,
  tableName: string,
  level: number,
): Record<string, string | number> | undefined {
  if (!tableCache) return undefined;

  const raw = stripRefs(tableName).trim();
  const noSpace = raw.replace(/\s+/g, "");
  const keys = [tableName.trim(), raw, noSpace];

  for (const key of keys) {
    const row = tableCache[key]?.[level];
    if (row) return row;
  }
  return undefined;
}

function getCachedColumnValue(
  row: Record<string, string | number>,
  columnName: string,
): string | number | undefined {
  const raw = columnName.trim();
  const clean = stripRefs(raw).trim();
  const noSpace = clean.replace(/\s+/g, "");
  return row[raw] ?? row[clean] ?? row[noSpace];
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

/**
 * Resolves a $FNC-NAME$ function for the given row level.
 * Returns the computed numeric value, or undefined if the function is unknown.
 */
export function resolveFNC(
  name: string,
  level: number | string,
  tokens: Record<string, string>,
  isPvp: boolean,
  branchOverride?: string,
  branchMap?: Record<string, string>,
): number | undefined {
  if (name !== "TOTALPRICE") return undefined;

  const baseKey =
    isPvp && tokens["$FNC-PVP-COST$"] ? "$FNC-PVP-COST$" : "$FNC-COST$";
  const baseCosts = tokens[baseKey]?.split(";") || [];

  const numericLevel = parseLevelNumber(level);
  const branch = branchOverride || parseLevelBranch(level);
  const resolvedBranch =
    branch && branchMap ? resolveBranchSpec(branch, branchMap) : branch;

  let total = 0;

  const schemaStr = tokens["$FNC-SCHEMA$"];
  if (schemaStr) {
    const schema = schemaStr
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const trunkLetter = schema[0] || "N";
    const targetBranch = resolvedBranch || trunkLetter;

    let trunkLevel = 0;
    const branchLevels: Record<string, number> = {};

    for (let i = 0; i < baseCosts.length; i++) {
      const letter = schema[i] || trunkLetter;

      if (letter === trunkLetter) {
        if (targetBranch === trunkLetter) {
          if (trunkLevel <= numericLevel) {
            const num = parseNumeric(baseCosts[i]);
            total += isNaN(num) ? 0 : num;
          }
        } else {
          const num = parseNumeric(baseCosts[i]);
          total += isNaN(num) ? 0 : num;
        }
        trunkLevel++;
      } else {
        if (branchLevels[letter] === undefined) {
          branchLevels[letter] = trunkLevel;
        }

        if (targetBranch === letter) {
          if (branchLevels[letter] <= numericLevel) {
            const num = parseNumeric(baseCosts[i]);
            total += isNaN(num) ? 0 : num;
          }
        }
        branchLevels[letter]++;
      }
    }
  } else {
    for (let i = 0; i <= numericLevel && i < baseCosts.length; i++) {
      const num = parseNumeric(baseCosts[i]);
      total += isNaN(num) ? 0 : num;
    }
  }

  return total;
}

export type TableCache = Record<
  string,
  Record<number, Record<string, string | number>>
>;

/**
 * Resolves a token ($FNC-NAME$, $nVar$, or $Var$) to a value,
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
): string | number | undefined {
  token = stripRefs(token).trim();
  if (depth > 10) return undefined;

  const activeBranch = branchOverride || parseLevelBranch(level);
  let cachedBranchMap = branchMap;
  const getBranchMap = (): Record<string, string> =>
    (cachedBranchMap ??= buildBranchMap(tokens, isPvp));

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
      );

      if (typeof resolved === "number") {
        return formatReadOnly(resolved);
      }
      return resolved !== undefined ? String(resolved) : match;
    });
  }

  // $FNC-NAME$
  const fncMatch = token.match(/^\$FNC-([A-Z]+)\$$/);
  if (fncMatch) {
    return resolveFNC(
      fncMatch[1],
      level,
      tokens,
      isPvp,
      activeBranch,
      cachedBranchMap,
    );
  }

  // $Table.Column$
  const dotTokenMatch = token.match(/^\$(.+?)\.([^.$]+)\$$/);
  if (dotTokenMatch) {
    const [, tableNameRaw, columnNameRaw] = dotTokenMatch;
    const numLevel = parseLevelNumber(level);
    const tableName = tableNameRaw.trim();
    const columnName = columnNameRaw.trim();
    const cached = getCachedTableRow(tableCache, tableName, numLevel);

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
        );
        return resolved !== undefined ? resolved : stripRefs(String(cachedVal));
      }
    }

    return undefined;
  }

  // #expr or $Var$
  const isExpr = /^{{#expr:.*}}$/i.test(token);
  const isVar = token.startsWith("$") && tokens[token] !== undefined;

  if (isExpr || isVar) {
    let val = isVar ? tokens[token] : token;

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
      );
      return resolved !== undefined ? String(resolved) : "0";
    });

    const context = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [stripRefs(k), v]),
    );

    const numLevel = parseLevelNumber(level);
    val = val.replace(/^["'](.*)["']$/, "$1");

    val = val.replace(
      /([a-zA-Z0-9_ ]+)\.([a-zA-Z0-9_ ]+)/g,
      (match, tname, col) => {
        const tableName = tname.trim();
        const columnName = col.trim();
        const cached = getCachedTableRow(tableCache, tableName, numLevel);
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

    const result = evaluateFormula(val, context);
    return Number.isNaN(result) ? val : result;
  }

  return undefined;
}
