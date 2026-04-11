import { settingsStore } from "$lib/stores/settings.svelte";
import { toDisplayNumber, stripRefs } from "$lib/utils/format";

const ARITHMETIC_ALLOWED = /^[\d+\-*/%.()\sMathroundtruncpow,]+$/;

const replacerCache = new Map<
  string,
  (expr: string, ctx: Record<string, number>) => string
>();

function getReplacer(
  keys: string[],
): (expr: string, ctx: Record<string, number>) => string {
  const cacheKey = keys.join("\0");
  if (replacerCache.has(cacheKey)) return replacerCache.get(cacheKey)!;

  // for example "Cost" matching inside "Cost Efficiency"
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
  formula = formula.replace(/{{#expr:\s*(.*?)\s*}}/gi, "$1");

  // for example "Cost Efficiency" = "Cost_Efficiency"
  const numericContextAliased: Record<string, number> = {};

  for (const [key, value] of Object.entries(row)) {
    const n = toDisplayNumber(value);
    if (n !== null) {
      const cleanKey = stripRefs(key);
      numericContextAliased[cleanKey] = n;
      if (/\s/.test(cleanKey)) {
        numericContextAliased[cleanKey.replace(/\s+/g, "_")] = n;
      }
    }
  }

  let expression = formula
    .replace(/\+\+\s*([a-zA-Z0-9_\-$]+)/g, "(1 + $1)") // prefix ++
    .replace(/([a-zA-Z0-9_\-$]+)\s*\+\+/g, "($1 + 1)") // postfix ++
    .replace(/--\s*([a-zA-Z0-9_\-$]+)/g, "(1 - $1)") // prefix --
    .replace(/([a-zA-Z0-9_\-$]+)\s*--/g, "($1 - 1)"); // postfix --

  const keys = Object.keys(numericContextAliased);
  expression = getReplacer(keys)(expression, numericContextAliased);

  if (/\bround\b/.test(expression)) {
    const parts = expression.split(/\bround\b/);
    let res = parts[0];
    for (let i = 1; i < parts.length; i++) {
      res = `(Math.round((${res}) * Math.pow(10, Math.trunc(${parts[i]}))) / Math.pow(10, Math.trunc(${parts[i]})))`;
    }
    expression = res;
  }

  if (!ARITHMETIC_ALLOWED.test(expression)) {
    console.error(
      `[Evaluator] Formula contains disallowed syntax: "${expression}"`,
    );
    return NaN;
  }

  try {
    const result = new Function(`return ${expression}`)();

    if (settingsStore.debugMode) {
      console.log(`[Evaluator] "${formula}" -> "${expression}" -> ${result}`);
    }

    return typeof result === "number" ? result : NaN;
  } catch (e) {
    console.error(`[Evaluator] Error evaluating "${expression}":`, e);
    return NaN;
  }
}
