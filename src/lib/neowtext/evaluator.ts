import { settingsStore } from "$lib/stores/settings.svelte";
import { toDisplayNumber, stripRefs } from "$lib/utils/format";

const ARITHMETIC_ALLOWED = /^[\d.\s+\-*/%()_a-zA-Z]*$/;
const DISALLOWED_SYNTAX = /[{}[\]:;,@#$&|^~`\\]/;

const replacerCache = new Map<
  string,
  (expr: string, ctx: Record<string, number>) => string
>();

function getReplacer(
  keys: string[],
): (expr: string, ctx: Record<string, number>) => string {
  const cacheKey = keys.join("\0");
  if (replacerCache.has(cacheKey)) return replacerCache.get(cacheKey)!;

  const sorted = [...keys]
    .filter((k) => k.trim())
    .sort((a, b) => b.length - a.length);
  const regex = new RegExp(
    sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g",
  );

  const fn = (expr: string, ctx: Record<string, number>) =>
    expr.replace(regex, (match) => String(ctx[match] ?? match));

  replacerCache.set(cacheKey, fn);
  return fn;
}

/**
 * Evaluates a formula string using variables from a row.
 * Only arithmetic operations are allowed.
 */
export function evaluateFormula(
  formula: string,
  row: Record<string, string | number>,
): number {
  const numericContext: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    const n = toDisplayNumber(value);
    if (n !== null) numericContext[stripRefs(key)] = n;
  }

  // for example "Cost Efficiency" = "Cost_Efficiency"
  const numericContextAliased: Record<string, number> = {
    ...numericContext,
  };
  for (const k of Object.keys(numericContext)) {
    if (/\s/.test(k)) {
      const underscored = k.replace(/\s+/g, "_");
      if (!(underscored in numericContextAliased)) {
        numericContextAliased[underscored] = numericContext[k];
      }
    }
  }

  if (!ARITHMETIC_ALLOWED.test(formula) || DISALLOWED_SYNTAX.test(formula)) {
    console.error(
      `[Evaluator] Formula contains disallowed syntax: "${formula}"`,
    );
    return NaN;
  }

  const keys = Object.keys(numericContextAliased);
  const replace = getReplacer(keys);
  const expression = replace(formula, numericContextAliased);

  try {
    const result = new Function(`return ${expression}`)();
    if (settingsStore.debugMode)
      console.log(`[Evaluator] "${formula}" -> "${expression}" -> ${result}`);
    return typeof result === "number" ? result : NaN;
  } catch (e) {
    console.error(`[Evaluator] Error evaluating "${expression}":`, e);
    return NaN;
  }
}
