import { formatValue, formatReadOnly } from "$lib/utils/format";

const FANDOM_BASE = "https://tds.fandom.com/wiki/";

function wikilinkToAnchor(link: string, text: string): string {
  const slug = link.trim().replace(/ /g, "_");
  const url = FANDOM_BASE + encodeURIComponent(slug);
  return `<a href="${url}" target="_blank" rel="noopener" class="wiki-link">${text.trim()}</a>`;
}

export function renderCellHtml(val: unknown, readOnly = false): string {
  let str: string;
  if (readOnly) {
    const n =
      typeof val === "number" ? val : Number(String(val).replace(/,/g, ""));
    str = Number.isFinite(n) ? formatReadOnly(n) : formatValue(val);
  } else {
    str = formatValue(val);
  }
  return str
    .replace(/\n/g, "<br>")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, link, text) =>
      wikilinkToAnchor(link, text),
    )
    .replace(/\[\[([^\]]+)\]\]/g, (_, link) => wikilinkToAnchor(link, link));
}
