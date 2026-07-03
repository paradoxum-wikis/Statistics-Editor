import { settingsStore } from "$lib/stores/settings.svelte";

/**
 * Strips ignore directives:
 *
 * - `<!-- \@se-ignore -->` for opening
 * - `<!-- \@/se-ignore -->` for closing
 * - `<!-- \@se-ignore/ -->` for self-closing
 */
export function stripSeIgnore(text: string): string {
  return text
    .replace(/<!--\s*@se-ignore\s*-->[\s\S]*?<!--\s*@\/se-ignore\s*-->/gi, "")
    .split("\n")
    .filter((line) => !/<!--\s*@se-ignore\/\s*-->/.test(line))
    .join("\n");
}

// @se-diff
const SE_DIFF_INLINE_RE = /<!--\s*@se-diff:(.*?)\s*-->/gis;

export function mkCellKey(
  skin: string,
  tableIdx: number,
  rowIdx: number,
  header: string,
): string {
  return `${skin}:${tableIdx}:${rowIdx}:${header}`;
}

export function parseCellKey(
  key: string,
): { skin: string; tableIdx: number; rowIdx: number; header: string } | null {
  const i1 = key.indexOf(":");
  const i2 = key.indexOf(":", i1 + 1);
  const i3 = key.indexOf(":", i2 + 1);
  if (i1 < 0 || i2 < 0 || i3 < 0) return null;
  const tableIdx = Number(key.slice(i1 + 1, i2));
  const rowIdx = Number(key.slice(i2 + 1, i3));
  if (!Number.isFinite(tableIdx) || !Number.isFinite(rowIdx)) return null;
  return {
    skin: key.slice(0, i1),
    tableIdx,
    rowIdx,
    header: key.slice(i3 + 1),
  };
}

function parseSeDiffPayload(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    if (settingsStore.debugMode) {
      console.log(`[parseSeDiffPayload] Invalid payload: ${raw}`);
    }
  }
  return {};
}

export function extractSeDiff(text: string): {
  text: string;
  baseline: Record<string, unknown>;
} {
  const baseline: Record<string, unknown> = {};
  const stripped = text.replace(SE_DIFF_INLINE_RE, (_, payload: string) => {
    Object.assign(baseline, parseSeDiffPayload(payload));
    return "";
  });
  return { text: stripped.trimEnd(), baseline };
}

export function stripSeDiff(text: string): string {
  return extractSeDiff(text).text;
}

export function embedSeDiff(
  text: string,
  baseline: Record<string, unknown>,
): string {
  const stripped = stripSeDiff(text).trimEnd();
  if (Object.keys(baseline).length === 0) return stripped;
  return `${stripped}\n<!-- @se-diff:${JSON.stringify(baseline)} -->`;
}

/**
 * Remove all `@se-*` directives before parsing wikitext.
 */
export function stripDirectives(text: string): string {
  return stripSeDiff(stripSeIgnore(text));
}

/**
 * Extract `@se-diff` payload and strip parse-time directives.
 */
export function extractDirectives(text: string): {
  text: string;
  baseline: Record<string, unknown>;
} {
  const { text: withoutDiff, baseline } = extractSeDiff(text);
  return { text: stripSeIgnore(withoutDiff), baseline };
}
