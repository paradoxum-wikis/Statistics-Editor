/**
 * Strips garbage ref tag for visual display.
 */
export function stripRefs(s: unknown): string {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref\b[^>]*\/>/gi, "");
}

/**
 * Parses a string or number into a number.
 * Commas are stripped before conversion.
 */
export function parseNumeric(v: string | number): number {
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return NaN;
  return Number(s);
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
export function formatReadOnly(v: unknown): string {
  if (v === undefined || v === null || v === "") return "-";
  const n = typeof v === "number" ? v : parseNumeric(String(v));
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : stripRefs(v);
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
  if (typeof v === "string") return stripRefs(v);
  return JSON.stringify(v);
}

/**
 * Formats with ROF bug into account
 */
export function applyROFBug(seconds: number): number {
  if (isNaN(seconds) || seconds <= 0) return seconds;
  const raw_frames = seconds * 60;
  const frames =
    Math.abs(raw_frames - Math.round(raw_frames)) < 1e-9
      ? Math.round(raw_frames) + 1.5
      : Math.ceil(raw_frames) + 1;
  return Math.round((frames / 60) * 1000) / 1000;
}
