import { evaluateFormula } from "$lib/neowtext/evaluator";
import { parseNumeric, stripRefs, formatReadOnly } from "$lib/utils/format";

/**
 * Resolves a $FNC-NAME$ function for the given row level.
 * Returns the computed numeric value, or undefined if the function is unknown.
 */
export function resolveFNC(
  name: string,
  level: number | string,
  tokens: Record<string, string>,
  isPvp: boolean,
): number | undefined {
  if (name !== "TOTALPRICE") return undefined;

  const baseKey =
    isPvp && tokens["$FNC-PVP-COST$"] ? "$FNC-PVP-COST$" : "$FNC-COST$";
  const baseCosts = tokens[baseKey]?.split(";") || [];

  let numericLevel = typeof level === "number" ? level : parseInt(level, 10);
  if (isNaN(numericLevel)) numericLevel = 0;

  const branchMatch =
    typeof level === "string" ? level.match(/[A-Za-z]+$/) : null;
  const branch = branchMatch ? branchMatch[0] : "";

  let total = 0;

  const schemaStr = tokens["$FNC-SCHEMA$"];
  if (schemaStr) {
    const schema = schemaStr
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const trunkLetter = schema[0] || "N";
    const targetBranch = branch || trunkLetter;

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
): string | number | undefined {
  token = stripRefs(token).trim();
  if (depth > 10) return undefined;

  if (
    /\$[^$]+\$/.test(token) &&
    !/^\$[^$]+\$$/.test(token) &&
    !/^{{#expr:.*}}$/i.test(token)
  ) {
    return token.replace(/\$([^$\s]+)\$/g, (match) => {
      const resolved = resolveToken(
        match,
        level,
        row,
        tokens,
        isPvp,
        depth + 1,
      );

      if (typeof resolved === "number") {
        return formatReadOnly(resolved);
      }
      return resolved !== undefined ? String(resolved) : match;
    });
  }

  // $FNC-NAME$
  const fncMatch = token.match(/^\$FNC-([A-Z]+)\$$/);
  if (fncMatch) return resolveFNC(fncMatch[1], level, tokens, isPvp);

  // #expr or $Var$
  const isExpr = /^{{#expr:.*}}$/i.test(token);
  const isVar = token.startsWith("$") && tokens[token] !== undefined;

  if (isExpr || isVar) {
    let val = isVar ? tokens[token] : token;

    if (isVar && /^\$[^$]+\$$/.test(val)) {
      return resolveToken(val, level, row, tokens, isPvp, depth + 1);
    }

    val = val.replace(/\$([^$\s]+)\$/g, (match) => {
      const resolved = resolveToken(
        match,
        level,
        row,
        tokens,
        isPvp,
        depth + 1,
      );
      return resolved !== undefined ? String(resolved) : "0";
    });

    const context = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [stripRefs(k), v]),
    );

    const result = evaluateFormula(val, context);
    return Number.isNaN(result) ? val : result;
  }

  return undefined;
}
