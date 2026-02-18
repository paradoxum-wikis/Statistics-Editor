import { evaluateFormula } from "$lib/wikitext/evaluator";

/**
 * Resolves a $FNC-NAME$ function for the given row level.
 * Returns the computed numeric value, or undefined if the function is unknown.
 */
export function resolveFNC(
  name: string,
  level: number,
  costVars: Record<string, string>,
): number | undefined {
  if (name === "TOTALPRICE") {
    let total = 0;
    for (let l = 0; l <= level; l++) {
      const costStr = costVars[`$${l}Cost$`];
      if (costStr === undefined) continue;
      const num = Number(String(costStr).replace(/,/g, ""));
      if (!isNaN(num)) total += num;
    }
    return total;
  }
  return undefined;
}

/**
 * Resolves a token ($FNC-NAME$, $nVar$, or $Var$) to a value,
 * recursing through token aliases when a $Var$ points to another token.
 */
export function resolveToken(
  token: string,
  level: number,
  row: Record<string, string | number>,
  formulaTokens: Record<string, string>,
  variables: Record<string, string>,
  isPvpSkin: boolean,
  depth = 0,
): string | number | undefined {
  if (depth > 10) return undefined;

  // $FNC-NAME$
  const fncMatch = token.match(/^\$FNC-([A-Z]+)\$$/);
  if (fncMatch) {
    return resolveFNC(fncMatch[1], level, formulaTokens);
  }

  // $nVar$
  const nVarMatch = token.match(/^\$n(.+)\$$/);
  if (nVarMatch) {
    const suffix = nVarMatch[1];
    const pvpKey = `$PVP-${level}${suffix}$`;
    const baseKey = `$${level}${suffix}$`;
    const varVal =
      isPvpSkin && variables[pvpKey] !== undefined
        ? variables[pvpKey]
        : variables[baseKey];
    if (varVal === undefined) return undefined;
    const num = Number(String(varVal).replace(/,/g, ""));
    return isNaN(num) ? varVal : num;
  }

  // $Var$
  if (token.startsWith("$") && formulaTokens[token] !== undefined) {
    const formulaVal = formulaTokens[token];
    if (/^\$[^$]+\$$/.test(formulaVal)) {
      return resolveToken(
        formulaVal,
        level,
        row,
        formulaTokens,
        variables,
        isPvpSkin,
        depth + 1,
      );
    }
    return evaluateFormula(formulaVal, row);
  }

  return undefined;
}
