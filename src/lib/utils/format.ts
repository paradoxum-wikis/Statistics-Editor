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
 * Normalizes a column key by stripping refs and wikilinks, and removing $refs$.
 */
export function normalizeColumnKey(s: unknown): string {
  if (s === undefined || s === null) return "";
  return stripRefs(String(s))
    .replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\$[A-Z0-9_-]+\$/gi, "")
    .trim();
}

const RE_REF_ONLY_SUFFIX = /^(-?[\d.,]+)((\$[A-Z0-9_-]+\$)+)$/;

export function isRefOnlyVarSuffix(
  value: unknown,
  tokens: Record<string, string>,
): boolean {
  if (typeof value !== "string") return false;
  const match = stripRefs(value).trim().match(RE_REF_ONLY_SUFFIX);
  if (!match) return false;
  const suffixVars = match[2].match(/\$[A-Z0-9_-]+\$/g) ?? [];
  return suffixVars.every((v) => /^<ref\b/i.test((tokens[v] ?? "").trim()));
}

export function stripRefOnlyVarSuffix(
  value: unknown,
  tokens: Record<string, string>,
): string | number | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;

  const match = stripRefs(value).trim().match(RE_REF_ONLY_SUFFIX);
  if (!match || !isRefOnlyVarSuffix(value, tokens)) return value;

  const n = parseNumeric(match[1]);
  return Number.isFinite(n) ? n : match[1];
}

export function syncRefOnlyCellToken(
  formulaToken: string,
  newValue: string | number,
  tokens: Record<string, string>,
): string | null {
  if (!isRefOnlyVarSuffix(formulaToken, tokens)) return null;
  return typeof newValue === "number"
    ? formatNumber(newValue)
    : String(newValue).trim();
}

export function columnKeysEqual(a: string, b: string): boolean {
  const na = normalizeColumnKey(a);
  const nb = normalizeColumnKey(b);
  if (na === nb) return true;
  return na.replace(/\s+/g, "") === nb.replace(/\s+/g, "");
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

export const ROF_KEYS = [
  "$FNC-ROFBUG2019$",
  "$FNC-ROFBUG2020$",
  "$FNC-ROFBUG2022$",
  "$FNC-ROFBUG$",
];

/**
 * Returns the Rate of Fire Bug version and columns from the given tokens.
 */
export function getRofBugVer(
  tokens: Record<string, string> | undefined | null,
) {
  let type = "$FNC-ROFBUG2022";
  let colsStr = "";

  if (tokens) {
    for (const key of Object.keys(tokens)) {
      if (ROF_KEYS.includes(key)) {
        colsStr = tokens[key];
        type = key;
      }
    }
  }

  return {
    type,
    cols: colsStr
      ? colsStr
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  };
}

/**
 * Formats with ROF bug into account
 */
export function applyRofBug(
  seconds: number,
  type: string = "$FNC-ROFBUG2022",
): number {
  if (isNaN(seconds) || seconds <= 0) return seconds;

  const norm = type.replace(/^\$?FNC-?/, "").replace(/\$$/, "");
  if (norm === "ROFBUG2019") {
    return Math.round((seconds + 0.05) * 1000) / 1000;
  }

  if (norm === "ROFBUG2020") {
    return Math.round((seconds + 0.03) * 1000) / 1000;
  }

  const raw_frames = seconds * 60;
  const frames =
    Math.abs(raw_frames - Math.round(raw_frames)) < 1e-9
      ? Math.round(raw_frames) + 1.5
      : Math.ceil(raw_frames) + 1;
  // return frames / 60; // look into this later
  return Math.round((frames / 60) * 1000) / 1000;
}

/**
 * Parses a raw cell value to a number
 */
export function toNumericValue(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    const cleaned = stripRefs(v).replace(/,/g, "").trim();
    n = parseFloat(cleaned);
  } else {
    return null;
  }
  return Number.isFinite(n) ? n : null;
}

/**
 * Same numeric value the cell shows after {@link renderCellHtml}'s formatting
 */
export function toDisplayNumber(v: unknown, readOnly: boolean): number | null {
  if (v === undefined || v === null) return null;
  const s = readOnly ? formatReadOnly(v) : formatValue(v);
  if (s === "-" || s === "") return null;
  const n = parseNumeric(s);
  return Number.isFinite(n) ? n : null;
}
