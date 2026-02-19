/**
 * Evaluates a formula string using variables from a row.
 */
export function evaluateFormula(
  formula: string,
  row: Record<string, string | number>,
): number {
  const numericContext: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    let numVal: number;
    if (typeof value === "number") {
      numVal = value;
    } else {
      const clean = String(value).replace(/,/g, "");
      numVal = parseFloat(clean);
    }

    if (!isNaN(numVal)) {
      numericContext[key] = numVal;
    }
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

  let expression = formula;

  const keys = Object.keys(numericContextAliased)
    .filter((k) => k.trim() !== "")
    .sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedKey, "g");
    expression = expression.replace(regex, String(numericContextAliased[key]));
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expression}`)();
    console.log(
      `[Evaluator] Formula: "${formula}" -> Expression: "${expression}" -> Result: ${result}`,
    );
    return typeof result === "number" ? result : NaN;
  } catch (e) {
    console.error(`[Evaluator] Error evaluating "${expression}":`, e);
    return NaN;
  }
}
