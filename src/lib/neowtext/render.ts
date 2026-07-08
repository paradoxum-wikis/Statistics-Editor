import { formatValue, formatReadOnly, stripRefs } from "$lib/utils/format";

const FANDOM_BASE = "https://tds.fandom.com/wiki/";
const RE_CHAR_HEX = /(?:&amp;)?&#x([0-9a-fA-F]+);/g;
const RE_CHAR_DEC = /(?:&amp;)?&#([0-9]+);/g;
const RE_LBRACK = /&lbrack;|&lsqb;/g;
const RE_RBRACK = /&rbrack;|&rsqb;/g;
const RE_NEWLINE = /\n/g;
const RE_WIKILINK = /(\[{2,})\s*([^\]|]+?)(?:\|([^\]]+?))?\s*(\]{2,})/g;
const RE_WIKI_TABLE = /\{\|[\s\S]*?\|\}/g;
const RE_COLSPAN = /colspan\s*=\s*["']?(\d+)["']?/i;
const RE_ROWSPAN = /rowspan\s*=\s*["']?(\d+)["']?/i;

type PreviewCell = {
  tag: "th" | "td";
  content: string;
  colspan?: number;
  rowspan?: number;
  class?: string;
  style?: string;
};

type TableAttrs = {
  class?: string;
  style?: string;
};

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function parseQuotedAttr(attrStr: string, name: string): string | undefined {
  const match = attrStr.match(
    new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"),
  );
  return match?.[2]?.trim() || undefined;
}

function parseAttrSegment(attrStr: string) {
  const cm = RE_COLSPAN.exec(attrStr);
  const rm = RE_ROWSPAN.exec(attrStr);
  return {
    colspan: cm ? parseInt(cm[1], 10) : undefined,
    rowspan: rm ? parseInt(rm[1], 10) : undefined,
    class: parseQuotedAttr(attrStr, "class"),
    style: parseQuotedAttr(attrStr, "style"),
  };
}

function parseTableOpen(block: string): TableAttrs {
  const first = block.split("\n")[0]?.trim() ?? "";
  if (!first.startsWith("{|")) return {};
  const attrStr = first.slice(2).trim();
  return {
    class: parseQuotedAttr(attrStr, "class"),
    style: parseQuotedAttr(attrStr, "style"),
  };
}

function parseCellPart(raw: string, tag: "th" | "td"): PreviewCell {
  let content = raw.trim();
  const split = content.match(/^(.+?)\s*\|\s*(.*)$/s);
  if (split && /=/.test(split[1])) {
    const attrs = parseAttrSegment(split[1]);
    content = split[2];
    return { tag, content, ...attrs };
  }
  return { tag, content };
}

function cellHtmlAttrs(cell: PreviewCell): string {
  const parts: string[] = [];
  if (cell.colspan && cell.colspan > 1) parts.push(`colspan="${cell.colspan}"`);
  if (cell.rowspan && cell.rowspan > 1) parts.push(`rowspan="${cell.rowspan}"`);
  const base = `border border-border px-2 py-1 align-top ${
    cell.tag === "th" ? "font-medium bg-secondary/40" : "bg-secondary" // TH : TD
  }`;
  const cls = [base, cell.class].filter(Boolean).join(" ");
  parts.push(`class="${escapeAttr(cls)}"`);
  if (cell.style) parts.push(`style="${escapeAttr(cell.style)}"`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function wikilinkToAnchor(link: string, text: string): string {
  const slug = link.trim().replace(/ /g, "_");
  return `<a href="${FANDOM_BASE}${slug}" target="_blank" rel="noopener" class="wiki-link">${text.trim()}</a>`;
}

function renderInlineWikitext(s: string): string {
  let out = s
    .replace(/'''([^']+?)'''/g, '<span class="font-bold">$1</span>')
    .replace(/''([^']+?)''/g, '<span class="italic">$1</span>');

  if (!/[&\n\[]/.test(out)) return out;

  out = out
    .replace(RE_CHAR_HEX, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(RE_CHAR_DEC, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(RE_LBRACK, "[")
    .replace(RE_RBRACK, "]");

  return out
    .replace(RE_NEWLINE, "<br>")
    .replace(RE_WIKILINK, (_, _opens, link, text) =>
      wikilinkToAnchor(link, text ?? link),
    );
}

function parsePreviewTable(block: string): PreviewCell[][] {
  const rows: PreviewCell[][] = [];
  let row: PreviewCell[] = [];

  const flushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };

  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("{|") || line.startsWith("|}")) continue;

    if (line.startsWith("|+")) continue;

    if (line.startsWith("|-")) {
      flushRow();
      continue;
    }

    if (line.startsWith("!")) {
      for (const part of line.slice(1).split(/!!|\|\|/)) {
        row.push(parseCellPart(part, "th"));
      }
      continue;
    }

    if (line.startsWith("|")) {
      for (const part of line.slice(1).split("||")) {
        row.push(parseCellPart(part, "td"));
      }
      continue;
    }

    if (row.length) {
      const last = row.at(-1)!;
      last.content = last.content ? `${last.content}\n${raw}` : raw;
    }
  }

  flushRow();
  return rows;
}

function parseCaption(block: string): PreviewCell | null {
  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|+")) continue;
    let text = line.slice(2).trim();
    if (text.startsWith("|")) text = text.slice(1).trim();
    return parseCellPart(text, "td");
  }
  return null;
}

function captionHtmlAttrs(caption: PreviewCell): string {
  const parts: string[] = [];
  const cls = [
    "border-b border-border px-2 py-1 text-center font-medium",
    caption.class,
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(`class="${escapeAttr(cls)}"`);
  if (caption.style) parts.push(`style="${escapeAttr(caption.style)}"`);
  return ` ${parts.join(" ")}`;
}

function renderPreviewTable(block: string): string {
  const caption = parseCaption(block);
  const rows = parsePreviewTable(block);
  if (!caption?.content && !rows.length) return renderInlineWikitext(block);

  const open = parseTableOpen(block);
  const cell = (raw: string) => renderInlineWikitext(raw.trim());
  const tableClass = ["border-collapse", "border", "border-border", open.class]
    .filter(Boolean)
    .join(" ");

  let html = '<div class="max-w-full overflow-x-auto"><table';
  if (tableClass) html += ` class="${escapeAttr(tableClass)}"`;
  if (open.style) html += ` style="${escapeAttr(open.style)}"`;
  html += ">";

  if (caption?.content) {
    html += `<caption${captionHtmlAttrs(caption)}>${cell(caption.content)}</caption>`;
  }

  if (rows.length) {
    html += "<tbody>";
    for (const bodyRow of rows) {
      html += "<tr>";
      for (const bodyCell of bodyRow) {
        html += `<${bodyCell.tag}${cellHtmlAttrs(bodyCell)}>${cell(bodyCell.content)}</${bodyCell.tag}>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
  }

  return `${html}</table></div>`;
}

/**
 * Render a botched version of wikitext for table cells.
 */
export function renderCellHtml(
  val: string | number | null | undefined,
  readOnly: boolean,
): string {
  return renderInlineWikitext(
    readOnly ? formatReadOnly(val as any) : formatValue(val as any),
  );
}

/**
 * Render our current implementation of wikitext.
 */
export function renderWikitextHtml(text: string): string {
  if (!text) return "";

  const source = stripRefs(text);
  if (!source.includes("{|")) return renderInlineWikitext(source);

  let html = "";
  let last = 0;
  let match: RegExpExecArray | null;

  RE_WIKI_TABLE.lastIndex = 0;
  while ((match = RE_WIKI_TABLE.exec(source)) !== null) {
    if (match.index > last) {
      html += renderInlineWikitext(source.slice(last, match.index));
    }
    html += renderPreviewTable(match[0]);
    last = match.index + match[0].length;
  }

  if (last < source.length) html += renderInlineWikitext(source.slice(last));
  return html;
}
