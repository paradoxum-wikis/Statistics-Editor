import { settingsStore } from "$lib/stores/settings.svelte";
import { toNumericValue, stripRefs, normalizeColumnKey } from "$lib/utils/format";
import { transpileExpr } from "mediawiki-expr";

const ARITHMETIC_ALLOWED = /^[\w\s+\-*/%.(),<>=!&|?:;{}[\]"']+$/;

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
  formula = stripRefs(formula)
    .replace(/{{#expr:\s*(.*?)\s*}}/gi, "$1")
    .replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, "$1");

  // for example "Cost Efficiency" = "Cost_Efficiency"
  const numericContextAliased: Record<string, number> = {};
  const allKeys = new Set<string>();

  for (const [key, value] of Object.entries(row)) {
    const cleanKey = normalizeColumnKey(key);
    if (!cleanKey) continue;
    allKeys.add(cleanKey);
    if (/\s/.test(cleanKey)) allKeys.add(cleanKey.replace(/\s+/g, "_"));

    let n = toNumericValue(value);
    if (n === null) {
      const s = stripRefs(value).trim();
      if (s === "" || s === "-" || /^n\/?a$/i.test(s)) n = 0;
      else continue;
    }
    numericContextAliased[cleanKey] = n;
    if (/\s/.test(cleanKey)) {
      numericContextAliased[cleanKey.replace(/\s+/g, "_")] = n;
    }
  }

  let expression = getReplacer([...allKeys])(formula, numericContextAliased);

  expression = expression
    .replace(/\+\+\s*([a-zA-Z0-9_.\-$]+)/g, "(1 + $1)") // prefix ++
    .replace(/([a-zA-Z0-9_.\-$]+)\s*\+\+/g, "($1 + 1)") // postfix ++
    .replace(/--\s*([a-zA-Z0-9_.\-$]+)/g, "(1 - $1)") // prefix --
    .replace(/([a-zA-Z0-9_.\-$]+)\s*--/g, "($1 - 1)"); // postfix --

  try {
    if (!expression.trim()) return NaN;
    expression = transpileExpr(expression);

    if (!ARITHMETIC_ALLOWED.test(expression)) {
      if (settingsStore.debugMode) {
        console.error(
          `[Evaluator] Formula contains disallowed syntax: "${expression}"`,
        );
      }
      return NaN;
    }

    const result = new Function(`return ${expression}`)();

    if (settingsStore.debugMode) {
      console.log(`[Evaluator] "${formula}" -> "${expression}" -> ${result}`);
    }

    return typeof result === "number" ? result : NaN;
  } catch (e) {
    if (settingsStore.debugMode) {
      console.error(`[Evaluator] Error evaluating "${expression}":`, e);
    }
    return NaN;
  }
}
