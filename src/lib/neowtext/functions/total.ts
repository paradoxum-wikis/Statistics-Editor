import { parseNumeric, stripRefs } from "$lib/utils/format";
import { getFncValue, getVariantFncKey } from "./keys";
import {
  parseLevelBranch,
  parseLevelNumber,
  resolveBranchSpec,
} from "./schema";
import { resolveToken, type TableCache } from "../resolve";

/**
 * True when the var body is a semicolon list of numbers (FNC-COST-) and not a formula.
 */
function isNumericArrayBody(raw: string): boolean {
  const s = stripRefs(raw).trim();
  if (!s) return true;
  if (/\{\{|#expr/i.test(s)) return false;

  if (!s.includes(";")) return !Number.isNaN(parseNumeric(s));

  for (const part of s.split(";")) {
    const t = part.trim();
    if (t === "") continue;
    if (Number.isNaN(parseNumeric(t))) return false;
  }
  return true;
}

function sumSeriesThroughLevel(
  series: string[],
  level: number | string,
  tokens: Record<string, string>,
  branchOverride?: string,
  branchMap?: Record<string, string>,
): number {
  const numericLevel = parseLevelNumber(level);
  const branch = branchOverride || parseLevelBranch(level);
  const resolvedBranch =
    branch && branchMap ? resolveBranchSpec(branch, branchMap) : branch;

  let total = 0;
  const schemaStr = getFncValue(tokens, "SCHEMA");

  if (schemaStr) {
    const schema = schemaStr
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const trunkLetter = schema[0] || "N";
    const targetBranch = resolvedBranch || trunkLetter;

    let trunkLevel = 0;
    const branchLevels: Record<string, number> = {};

    for (let i = 0; i < series.length; i++) {
      const letter = schema[i] || trunkLetter;

      if (letter === trunkLetter) {
        if (targetBranch === trunkLetter) {
          if (trunkLevel <= numericLevel) {
            const num = parseNumeric(series[i]);
            total += isNaN(num) ? 0 : num;
          }
        } else {
          const num = parseNumeric(series[i]);
          total += isNaN(num) ? 0 : num;
        }
        trunkLevel++;
      } else {
        if (branchLevels[letter] === undefined) {
          branchLevels[letter] = trunkLevel;
        }

        if (targetBranch === letter) {
          if (branchLevels[letter] <= numericLevel) {
            const num = parseNumeric(series[i]);
            total += isNaN(num) ? 0 : num;
          }
        }
        branchLevels[letter]++;
      }
    }
  } else {
    for (let i = 0; i <= numericLevel && i < series.length; i++) {
      const num = parseNumeric(series[i]);
      total += isNaN(num) ? 0 : num;
    }
  }

  return total;
}

/**
 * $FNC-TOTALPRICE$ links with $FNC-COST$.
 * $FNC-TOTAL-X$ links with any array $VAR$ / $PVP-VAR$.
 */
export function resolveFNC(
  name: string,
  level: number | string,
  tokens: Record<string, string>,
  isPvp: boolean,
  branchOverride?: string,
  branchMap?: Record<string, string>,
  variantPrefix?: string,
  row: Record<string, string | number> = {},
  tableCache?: TableCache,
  applyRofToCache = false,
  depth = 0,
): number | undefined {
  const upper = name.toUpperCase();

  let seriesKey: string;
  if (upper === "TOTALPRICE") {
    seriesKey = getVariantFncKey(tokens, variantPrefix, "COST");
  } else {
    const m = upper.match(/^TOTAL-(.+)$/);
    if (!m?.[1]) return undefined;
    const plain = `$${m[1]}$`;
    if (variantPrefix) {
      const variantKey = `$${variantPrefix}-${m[1]}$`;
      seriesKey = tokens[variantKey] !== undefined ? variantKey : plain;
    } else {
      seriesKey = plain;
    }
  }

  const raw = tokens[seriesKey] ?? "";

  if (upper === "TOTALPRICE" || isNumericArrayBody(raw)) {
    return sumSeriesThroughLevel(
      raw.split(";"),
      level,
      tokens,
      branchOverride,
      branchMap,
    );
  }

  // Formula series can't be split on ';'
  const numericLevel = parseLevelNumber(level);
  let total = 0;
  for (let i = 0; i <= numericLevel; i++) {
    const res = resolveToken(
      seriesKey,
      i,
      { ...row, Level: i },
      tokens,
      isPvp,
      depth + 1,
      tableCache,
      applyRofToCache,
      false,
      branchOverride,
      branchMap,
      variantPrefix,
    );
    if (typeof res === "number") {
      if (Number.isFinite(res)) total += res;
    } else if (res !== undefined) {
      const n = parseNumeric(res);
      if (!Number.isNaN(n)) total += n;
    }
  }
  return total;
}
