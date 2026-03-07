/**
 * Parses a string or number into a number.
 * Commas are stripped before conversion.
 */
export function parseNumeric(v: string | number): number {
  if (typeof v === "number") return v;
  return Number(String(v).replace(/,/g, ""));
}

/**
 * Formats a number with separators.
 * Uses up to 10 significant decimal digits then strips trailing zeros.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 10 });
}

/**
 * Formats a calculated number with separators + 2 decimal places.
 */
export function formatReadOnly(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
