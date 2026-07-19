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

const SE_DIFF_INLINE_RE = /<!--\s*@se-diff:(.*?)\s*-->/gis;
const SE_MEMO_INLINE_RE = /<!--\s*@se-memo:(.*?)\s*-->/gis;
/**
 * The maximum JSON payload per comment before splitting into adjacent `@se-memo` blocks.
 */
const MEMO_JSON_CHUNK = 8000;

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

function parseSeMemoPayload(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (typeof parsed === "string") return parsed;
  } catch {
    if (settingsStore.debugMode) {
      console.log(`[parseSeMemoPayload] Invalid payload: ${raw}`);
    }
  }
  return "";
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
  return { text: stripped, baseline };
}

export function stripSeDiff(text: string): string {
  return extractSeDiff(text).text;
}

// separate from SE_DIFF_INLINE_RE `g` so lastIndex cannot poison repeated usage.
export function hasSeDiff(text: string): boolean {
  return /<!--\s*@se-diff:/i.test(text);
}

export function extractSeMemo(text: string): {
  text: string;
  memo: string;
} {
  const parts: string[] = [];
  const stripped = text.replace(SE_MEMO_INLINE_RE, (_, payload: string) => {
    parts.push(parseSeMemoPayload(payload));
    return "";
  });
  return { text: stripped, memo: parts.join("") };
}

export function stripSeMemo(text: string): string {
  return extractSeMemo(text).text;
}

/** Strip `@se-memo` and `@se-diff` (not `@se-ignore`). */
export function stripSeMeta(text: string): string {
  return stripSeMemo(stripSeDiff(text));
}

function memoComments(memo: string): string {
  const comment = (slice: string) =>
    `<!-- @se-memo:${JSON.stringify(slice)} -->`;
  const json = JSON.stringify(memo);
  if (json.length <= MEMO_JSON_CHUNK) return comment(memo);

  const comments: string[] = [];
  for (let i = 0; i < memo.length;) {
    let end = Math.min(memo.length, i + 2000);
    let slice = memo.slice(i, end);
    while (JSON.stringify(slice).length > MEMO_JSON_CHUNK && slice.length > 1) {
      slice = memo.slice(i, --end);
    }
    comments.push(comment(slice));
    i += slice.length;
  }
  return comments.join("");
}

export function embedSeDirectives(
  text: string,
  opts: { memo?: string; baseline?: Record<string, unknown> } = {},
): string {
  const body = stripSeMeta(text).replace(/\s+$/, "");
  const tail =
    (opts.memo ? memoComments(opts.memo) : "") +
    (opts.baseline && Object.keys(opts.baseline).length > 0
      ? `<!-- @se-diff:${JSON.stringify(opts.baseline)} -->`
      : "");
  const out = tail ? `${body}${tail}` : body;
  return out.length > 0 && !out.endsWith("\n") ? `${out}\n` : out;
}

/**
 * Remove all `@se-*` directives before parsing wikitext.
 */
export function stripDirectives(text: string): string {
  return stripSeIgnore(stripSeMeta(text));
}

/**
 * Extract `@se-diff`/`@se-memo` payloads and strip parse-time directives.
 */
export function extractDirectives(text: string): {
  text: string;
  baseline: Record<string, unknown>;
  memo: string;
} {
  const { text: withoutMemo, memo } = extractSeMemo(text);
  const { text: withoutDiff, baseline } = extractSeDiff(withoutMemo);
  return { text: stripSeIgnore(withoutDiff), baseline, memo };
}
