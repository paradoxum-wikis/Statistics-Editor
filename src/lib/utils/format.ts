/**
 * Parses a string or number into a number.
 * Commas are stripped before conversion.
 */
export function parseNumeric(v: string | number): number {
  if (typeof v === "number") return v;
  return Number(String(v).replace(/,/g, ""));
}

/**
 * Formats a number using magnitude based decimal places:
 * >= 1000   -> 0 decimals
 * >= 100    -> 2 decimals
 * >= 1      -> 3 decimals
 * >= 0.01   -> 4 decimals
 * >= 0.0001 -> 6 decimals
 * otherwise -> precision format
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";

  const abs = Math.abs(n);

  if (abs >= 1000) return String(Number(n.toFixed(0)));
  if (abs >= 100) return String(Number(n.toFixed(2)));
  if (abs >= 1) return String(Number(n.toFixed(3)));
  if (abs >= 0.01) return String(Number(n.toFixed(4)));
  if (abs >= 0.0001) return String(Number(n.toFixed(6)));

  return n.toPrecision(6).replace(/\.?0+(e|$)/, "$1");
}

/**
 * Formats a value for display in the table,
 * handling undefined/null, numbers, booleans, and strings.
 *
 * Other types are JSON stringified.
 */
export function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "-";
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
