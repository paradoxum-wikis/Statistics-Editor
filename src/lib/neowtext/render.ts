import { formatValue, formatReadOnly } from "$lib/utils/format";

const FANDOM_BASE = "https://tds.fandom.com/wiki/";
const RE_CHAR_HEX = /(?:&amp;)?&#x([0-9a-fA-F]+);/g;
const RE_CHAR_DEC = /(?:&amp;)?&#([0-9]+);/g;
const RE_LBRACK = /&lbrack;|&lsqb;/g;
const RE_RBRACK = /&rbrack;|&rsqb;/g;
const RE_NEWLINE = /\n/g;
const RE_WIKILINK = /(\[{2,})\s*([^\]|]+?)(?:\|([^\]]+?))?\s*(\]{2,})/g;

function wikilinkToAnchor(link: string, text: string): string {
  const slug = link.trim().replace(/ /g, "_");
  return `<a href="${FANDOM_BASE}${slug}" target="_blank" rel="noopener" class="wiki-link">${text.trim()}</a>`;
}

/**
 * Render a table cell value to HTML for display
 */
export function renderCellHtml(
  val: string | number | null | undefined,
  readOnly = false,
): string {
  let s = readOnly ? formatReadOnly(val as any) : formatValue(val as any);

  if (!/[&\n\[]/.test(s)) return s;

  s = s.replace(RE_CHAR_HEX, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  s = s.replace(RE_CHAR_DEC, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10)),
  );
  s = s.replace(RE_LBRACK, "[").replace(RE_RBRACK, "]");

  return s
    .replace(RE_NEWLINE, "<br>")
    .replace(RE_WIKILINK, (_, _opens, link, text) =>
      wikilinkToAnchor(link, text ?? link),
    );
}
