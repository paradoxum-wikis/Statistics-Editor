import { evaluateFormula } from "$lib/neowtext/evaluator";
import { parseNumeric, applyROFBug } from "$lib/utils/format";
import { settingsStore } from "$lib/stores/settings.svelte";

/**
 * Resolves a $FNC-NAME$ function for the given row level.
 * Returns the computed numeric value, or undefined if the function is unknown.
 */
export function resolveFNC(
  name: string,
  level: number,
  tokens: Record<string, string>,
  isPvp: boolean,
): number | undefined {
  if (name !== "TOTALPRICE") return undefined;

  const key =
    isPvp && tokens["$FNC-PVP-COST$"] ? "$FNC-PVP-COST$" : "$FNC-COST$";
  const costs = tokens[key]?.split(";") || [];

  return costs.slice(0, level + 1).reduce((sum, cost) => {
    const num = parseNumeric(cost);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}

/**
 * Resolves a token ($FNC-NAME$, $nVar$, or $Var$) to a value,
 * recursing through token aliases when a $Var$ points to another token.
 */
export function resolveToken(
  token: string,
  level: number,
  row: Record<string, string | number>,
  tokens: Record<string, string>,
  isPvp: boolean,
  depth = 0,
): string | number | undefined {
  if (depth > 10) return undefined;

  // $FNC-NAME$
  const fncMatch = token.match(/^\$FNC-([A-Z]+)\$$/);
  if (fncMatch) return resolveFNC(fncMatch[1], level, tokens, isPvp);

  // $Var$
  if (token.startsWith("$") && tokens[token] !== undefined) {
    const val = tokens[token];
    if (/^\$[^$]+\$$/.test(val)) {
      return resolveToken(val, level, row, tokens, isPvp, depth + 1);
    }
    return evaluateFormula(val, row);
  }

  return undefined;
}
