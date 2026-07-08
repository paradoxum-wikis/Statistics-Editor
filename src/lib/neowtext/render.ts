import { formatValue, formatReadOnly, stripRefs } from "$lib/utils/format";
import {
  IMAGE_EXT,
  proxyImageUrl,
  isAllowedExternalImageUrl,
  isDirectImageUrl,
  resolveWikiFileUrl,
} from "$lib/services/imageLoader";

const FANDOM_BASE = "https://tds.fandom.com/wiki/";
const RE_CHAR_HEX = /(?:&amp;)?&#x([0-9a-fA-F]+);/g;
const RE_CHAR_DEC = /(?:&amp;)?&#([0-9]+);/g;
const RE_LBRACK = /&lbrack;|&lsqb;/g;
const RE_RBRACK = /&rbrack;|&rsqb;/g;
const RE_NEWLINE = /\n/g;
const RE_WIKILINK = /(\[{2,})\s*([^\]|]+?)(?:\|([^\]]+?))?\s*(\]{2,})/g;
const RE_EXT_LINK = /\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]*))?\]/g;
const RE_BARE_EXT_IMAGE = new RegExp(
  `https?:\\/\\/[^\\s\\[\\]<>"']+\\.(?:${IMAGE_EXT})(?:\\/revision\\/[^\\s\\[\\]<>"']*)?(?:\\?[^\\s\\[\\]<>"']*)?`,
  "gi",
);
const RE_WIKI_TABLE = /\{\|[\s\S]*?\|\}/g;
const RE_COLSPAN = /colspan\s*=\s*["']?(\d+)["']?/i;
const RE_ROWSPAN = /rowspan\s*=\s*["']?(\d+)["']?/i;
const RE_QUOTED_CLASS = /class\s*=\s*(["'])([\s\S]*?)\1/i;
const RE_QUOTED_STYLE = /style\s*=\s*(["'])([\s\S]*?)\1/i;
const RE_TH_PARTS = /!!|\|\|/;
const RE_HEADING = /^(=+)([^=].*?)\1\s*$/;
const RE_HR = /^-{4,}\s*$/;
const RE_LIST_ITEM = /^([*#]+)\s*(.*)$/;
const RE_DL_TERM = /^;\s*(.*)$/;
const RE_DL_DEF = /^:\s*(.*)$/;
const RE_INDENT = /^(:+)\s*(.*)$/;
const RE_HTML_LINE = /^\s*<(?:!--|\/[a-zA-Z]|[a-zA-Z])/;
const RE_FILE_NS = /^(?:File|Image)\s*:/i;
const RE_SIZE_W = /^(\d+)\s*px$/i;
const RE_SIZE_H = /^x(\d+)\s*px$/i;
const DEFAULT_THUMB_WIDTH = 220;

const HEADING_CLS: Record<number, string> = {
  1: "text-lg font-bold mt-3 mb-1.5",
  2: "text-base font-semibold mt-3 mb-1",
  3: "text-sm font-semibold mt-2.5 mb-1",
  4: "text-sm font-medium mt-2 mb-0.5",
  5: "text-xs font-medium mt-1.5 mb-0.5",
  6: "text-xs font-medium mt-1 mb-0.5",
};
const UL_CLS = "list-disc pl-5 my-1";
const OL_CLS = "list-decimal pl-5 my-1";
const INDENT_CLS = ["", "pl-4", "pl-8", "pl-12", "pl-16"];

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

type ParsedPreviewTable = {
  open: TableAttrs;
  caption: PreviewCell | null;
  rows: PreviewCell[][];
};

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function parseQuotedAttr(attrStr: string, re: RegExp): string | undefined {
  const match = attrStr.match(re);
  return match?.[2]?.trim() || undefined;
}

function parseAttrSegment(attrStr: string) {
  const cm = RE_COLSPAN.exec(attrStr);
  const rm = RE_ROWSPAN.exec(attrStr);
  return {
    colspan: cm ? parseInt(cm[1], 10) : undefined,
    rowspan: rm ? parseInt(rm[1], 10) : undefined,
    class: parseQuotedAttr(attrStr, RE_QUOTED_CLASS),
    style: parseQuotedAttr(attrStr, RE_QUOTED_STYLE),
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

type ParsedFileOpts = {
  thumb?: boolean;
  border?: boolean;
  width?: number;
  height?: number;
  align?: "left" | "right" | "center";
  alt?: string;
  caption?: string;
  link?: string;
  noLink?: boolean;
  htmlClass?: string;
};

function parseFileOptions(parts: string[]): ParsedFileOpts {
  const opts: ParsedFileOpts = {};
  const captions: string[] = [];

  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;

    const lower = p.toLowerCase();
    if (lower === "thumb") opts.thumb = true;
    else if (lower === "border") opts.border = true;
    else if (lower === "left" || lower === "right" || lower === "center")
      opts.align = lower;
    else if (lower.startsWith("alt=")) opts.alt = p.slice(4);
    else if (lower.startsWith("class=")) opts.htmlClass = p.slice(6).trim();
    else if (lower.startsWith("link=")) {
      const target = p.slice(5);
      if (!target) opts.noLink = true;
      else opts.link = target;
    } else if (RE_SIZE_W.test(p)) opts.width = parseInt(p, 10);
    else if (RE_SIZE_H.test(p)) opts.height = parseInt(p.slice(1), 10);
    else captions.push(p);
  }

  if (captions.length) opts.caption = captions[captions.length - 1];
  return opts;
}

function fileAlignCls(align?: ParsedFileOpts["align"]): string {
  if (align === "left") return "float-left mr-3";
  if (align === "right") return "float-right ml-3";
  if (align === "center") return "mx-auto block";
  return "";
}

function fileLinkHref(link: string): string {
  if (/^https?:\/\//i.test(link)) return link;
  return `${FANDOM_BASE}${link.trim().replace(/ /g, "_")}`;
}

function fandomImgAttrs(url: string, wikiFile = false): string {
  const wikia = wikiFile || isAllowedExternalImageUrl(url);
  if (!wikia) return `src="${escapeAttr(url)}"`;
  return `src="${escapeAttr(proxyImageUrl(url))}"`;
}

function renderWikiFileHtml(
  fileRef: string,
  src: string,
  opts: ParsedFileOpts,
): string {
  const filename = fileRef.replace(/^(?:File|Image):\s*/i, "").trim();
  const alt = escapeAttr(opts.alt ?? opts.caption ?? filename);

  let width = opts.width;
  const height = opts.height;
  if (opts.thumb && !width && !height) width = DEFAULT_THUMB_WIDTH;

  const capped = opts.thumb;
  const sized = !!(width || height);

  const imgStyle = sized
    ? [
        width ? `${capped ? "max-" : ""}width:${width}px` : null,
        height ? `${capped ? "max-" : ""}height:${height}px` : null,
        height && !width ? "width:auto" : null,
      ]
        .filter(Boolean)
        .join(";")
    : "";

  const imgCls = [
    opts.thumb ? "block" : "inline align-middle",
    capped || !sized ? "max-w-full" : "",
    "h-auto",
    opts.border ? "border-2 border-primary" : "",
    opts.htmlClass,
  ]
    .filter(Boolean)
    .join(" ");

  const imgAttrs = [
    fandomImgAttrs(src, true),
    `alt="${alt}"`,
    `class="${escapeAttr(imgCls)}"`,
    'loading="lazy"',
    imgStyle ? `style="${escapeAttr(imgStyle)}"` : "",
    opts.caption && !opts.thumb ? `title="${escapeAttr(opts.caption)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  let inner = `<img ${imgAttrs} />`;

  if (!opts.noLink) {
    const href = opts.link
      ? fileLinkHref(opts.link)
      : `${FANDOM_BASE}${fileRef.trim().replace(/ /g, "_")}`;
    const external = /^https?:\/\//i.test(href);
    inner = `<a href="${escapeAttr(href)}" target="_blank" rel="noopener"${external ? "" : ' class="wiki-link"'}>${inner}</a>`;
  }

  const align = fileAlignCls(opts.align);

  if (opts.thumb) {
    return `<figure class="inline-block max-w-full my-1 ${align} border border-border bg-secondary/20 p-0.5"><div class="leading-none">${inner}</div>${
      opts.caption
        ? `<figcaption class="text-xs text-center mt-1 px-1 leading-snug">${renderInlineWikitext(opts.caption)}</figcaption>`
        : ""
    }</figure>`;
  }

  if (!align) return inner;
  return `<div class="${align} my-1 w-fit">${inner}</div>`;
}

function wikiFileToHtml(fileRef: string, optionStr?: string): string {
  const ref = fileRef.trim();
  const url = resolveWikiFileUrl(ref);
  const opts = optionStr ? parseFileOptions(optionStr.split("|")) : {};

  if (!url) {
    const name = ref.replace(/^(?:File|Image):\s*/i, "");
    return `<a href="${FANDOM_BASE}${ref.replace(/ /g, "_")}" target="_blank" rel="noopener" class="wiki-link">${name}</a>`;
  }

  return renderWikiFileHtml(ref, url, opts);
}

function wikilinkToAnchor(link: string, text: string): string {
  const slug = link.trim().replace(/ /g, "_");
  return `<a href="${FANDOM_BASE}${slug}" target="_blank" rel="noopener" class="wiki-link">${text.trim()}</a>`;
}

function externalImageToHtml(src: string, href?: string): string {
  const srcAttr = isAllowedExternalImageUrl(src)
    ? fandomImgAttrs(src)
    : `src="${escapeAttr(src)}"`;
  const img = `<img ${srcAttr} alt="" class="inline-block max-w-full h-auto align-middle" loading="lazy" />`;
  if (!href) return img;
  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener">${img}</a>`;
}

function extLinkToHtml(url: string, label?: string): string {
  const imageTarget = label?.trim();
  if (imageTarget && isAllowedExternalImageUrl(imageTarget)) {
    return externalImageToHtml(imageTarget, url);
  }
  return extLinkToAnchor(url, label);
}

function bareExternalUrlToHtml(url: string): string {
  if (isAllowedExternalImageUrl(url)) return externalImageToHtml(url);
  if (isDirectImageUrl(url)) return extLinkToAnchor(url);
  return url;
}

function replaceBareExternalImages(text: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    if (text.startsWith("[[", i)) {
      const end = text.indexOf("]]", i + 2);
      if (end === -1) {
        result += text.slice(i);
        break;
      }
      result += text.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    if (text[i] === "[") {
      const end = text.indexOf("]", i + 1);
      if (end === -1) {
        result += text.slice(i);
        break;
      }
      result += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    const next = text.slice(i).search(/[\[]/);
    const end = next === -1 ? text.length : i + next;
    result += text
      .slice(i, end)
      .replace(RE_BARE_EXT_IMAGE, (url) => bareExternalUrlToHtml(url));
    i = end;
  }

  return result;
}

function extLinkToAnchor(url: string, label?: string): string {
  const text = (label?.trim() || url).trim();
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="wiki-link">${text}</a>`;
}

function renderInlineWikitext(s: string): string {
  let out = s
    .replace(/'''([^']+?)'''/g, '<span class="font-bold">$1</span>')
    .replace(/''([^']+?)''/g, '<span class="italic">$1</span>');

  if (!/[&\n\[\]']/.test(out) && !/https?:\/\//i.test(out)) return out;

  out = out
    .replace(RE_CHAR_HEX, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(RE_CHAR_DEC, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(RE_LBRACK, "[")
    .replace(RE_RBRACK, "]");

  out = replaceBareExternalImages(out);

  return out
    .replace(RE_NEWLINE, "<br>")
    .replace(RE_EXT_LINK, (_, url, label) => extLinkToHtml(url, label))
    .replace(RE_WIKILINK, (_, _opens, link, text) =>
      RE_FILE_NS.test(link.trim())
        ? wikiFileToHtml(link, text)
        : wikilinkToAnchor(link, text ?? link),
    );
}

function matchHeading(line: string): { level: number; content: string } | null {
  const m = line.trim().match(RE_HEADING);
  if (!m) return null;
  const level = m[1].length;
  if (level < 1 || level > 6) return null;
  return { level, content: m[2].trim() };
}

function isBlockStarter(line: string): boolean {
  const t = line.trim();
  if (!t) return true;

  const c = t[0];
  if (c === "<") return RE_HTML_LINE.test(line);
  if (c === "=") return RE_HEADING.test(t);
  if (c === "-") return RE_HR.test(t);
  if (c === "*" || c === "#") return RE_LIST_ITEM.test(line);
  if (c === ";") return true;
  if (c === ":") return true;
  return false;
}

function renderHeading({ level, content }: { level: number; content: string }) {
  const cls = HEADING_CLS[level] ?? HEADING_CLS[6];
  return `<h${level} class="${cls}">${renderInlineWikitext(content)}</h${level}>`;
}

function renderListBlock(
  lines: string[],
  start: number,
  out: string[],
): number {
  const stack: ("ul" | "ol")[] = [];
  let i = start;

  const closeTo = (depth: number) => {
    while (stack.length > depth) out.push(`</${stack.pop()!}>`);
  };

  const openAt = (depth: number, kind: "ul" | "ol") => {
    closeTo(depth);
    while (stack.length < depth) {
      stack.push(kind);
      out.push(`<${kind} class="${kind === "ul" ? UL_CLS : OL_CLS}">`);
    }
    if (stack.length === depth && stack[depth - 1] !== kind) {
      out.push(`</${stack.pop()!}>`);
      stack.push(kind);
      out.push(`<${kind} class="${kind === "ul" ? UL_CLS : OL_CLS}">`);
    }
  };

  while (i < lines.length) {
    const m = lines[i].match(RE_LIST_ITEM);
    if (!m) break;
    const depth = m[1].length;
    const kind = m[1][0] === "*" ? "ul" : "ol";
    openAt(depth, kind);
    out.push(`<li class="my-0.5">${renderInlineWikitext(m[2])}</li>`);
    i++;
  }

  closeTo(0);
  return i;
}

function renderDefListBlock(
  lines: string[],
  start: number,
  out: string[],
): number {
  let i = start;
  if (!RE_DL_TERM.test(lines[i])) return start;

  out.push('<dl class="my-1">');
  while (i < lines.length) {
    const term = lines[i].match(RE_DL_TERM);
    if (term) {
      let text = term[1];
      const split = text.match(/^([^:]*?)\s*:\s*(.*)$/s);
      if (split?.[1].trim()) {
        out.push(
          `<dt class="font-medium">${renderInlineWikitext(split[1].trim())}</dt>`,
        );
        if (split[2].trim()) {
          out.push(
            `<dd class="pl-4 mb-1">${renderInlineWikitext(split[2].trim())}</dd>`,
          );
        }
      } else {
        out.push(
          `<dt class="font-medium">${renderInlineWikitext(text.trim())}</dt>`,
        );
      }
      i++;
      continue;
    }

    const def = lines[i].match(RE_DL_DEF);
    if (def) {
      out.push(`<dd class="pl-4 mb-1">${renderInlineWikitext(def[1])}</dd>`);
      i++;
      continue;
    }
    break;
  }
  out.push("</dl>");
  return i;
}

function renderBlockWikitext(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) break;

    const line = lines[i];

    if (RE_HTML_LINE.test(line)) {
      out.push(line);
      i++;
      continue;
    }

    const heading = matchHeading(line);
    if (heading) {
      out.push(renderHeading(heading));
      i++;
      continue;
    }

    if (RE_HR.test(line.trim())) {
      out.push('<hr class="border-border my-3" />');
      i++;
      continue;
    }

    if (RE_LIST_ITEM.test(line)) {
      i = renderListBlock(lines, i, out);
      continue;
    }

    if (RE_DL_TERM.test(line)) {
      i = renderDefListBlock(lines, i, out);
      continue;
    }

    const indent = line.match(RE_INDENT);
    if (indent) {
      const depth = Math.min(indent[1].length, INDENT_CLS.length - 1);
      out.push(
        `<div class="${INDENT_CLS[depth]} my-0.5">${renderInlineWikitext(indent[2] ?? "")}</div>`,
      );
      i++;
      continue;
    }

    const paraStart = i;
    const para: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (cur.trim() && isBlockStarter(cur)) break;

      if (!cur.trim()) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && isBlockStarter(lines[j])) break;
        para.push("");
        i++;
        continue;
      }

      para.push(cur);
      i++;
    }
    if (para.some((s) => s.length)) {
      out.push(`<p class="my-1">${renderInlineWikitext(para.join("\n"))}</p>`);
    } else if (i === paraStart) {
      i++; // avoid hang if a block-starter line was not consumed
    }
  }

  return out.join("");
}

function parsePreviewTableBlock(block: string): ParsedPreviewTable {
  const lines = block.split("\n");
  const open: TableAttrs = {};
  let caption: PreviewCell | null = null;
  const rows: PreviewCell[][] = [];
  let row: PreviewCell[] = [];

  const flushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("{|")) {
      const attrStr = line.slice(2).trim();
      open.class = parseQuotedAttr(attrStr, RE_QUOTED_CLASS);
      open.style = parseQuotedAttr(attrStr, RE_QUOTED_STYLE);
      continue;
    }

    if (line.startsWith("|}")) continue;

    if (line.startsWith("|+")) {
      let text = line.slice(2).trim();
      if (text.startsWith("|")) text = text.slice(1).trim();
      caption = parseCellPart(text, "td");
      continue;
    }

    if (line.startsWith("|-")) {
      flushRow();
      continue;
    }

    if (line.startsWith("!")) {
      for (const part of line.slice(1).split(RE_TH_PARTS)) {
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
  return { open, caption, rows };
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
  const { open, caption, rows } = parsePreviewTableBlock(block);
  if (!caption?.content && !rows.length) return renderBlockWikitext(block);

  const cell = (raw: string) => renderInlineWikitext(raw.trim());
  const tableClass = ["border-collapse", "border", "border-border", open.class]
    .filter(Boolean)
    .join(" ");

  const parts = ['<div class="max-w-full overflow-x-auto"><table'];
  if (tableClass) parts.push(` class="${escapeAttr(tableClass)}"`);
  if (open.style) parts.push(` style="${escapeAttr(open.style)}"`);
  parts.push(">");

  if (caption?.content) {
    parts.push(
      `<caption${captionHtmlAttrs(caption)}>${cell(caption.content)}</caption>`,
    );
  }

  if (rows.length) {
    parts.push("<tbody>");
    for (const bodyRow of rows) {
      parts.push("<tr>");
      for (const bodyCell of bodyRow) {
        parts.push(
          `<${bodyCell.tag}${cellHtmlAttrs(bodyCell)}>${cell(bodyCell.content)}</${bodyCell.tag}>`,
        );
      }
      parts.push("</tr>");
    }
    parts.push("</tbody>");
  }

  parts.push("</table></div>");
  return parts.join("");
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
  if (!source.includes("{|")) return renderBlockWikitext(source);

  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  RE_WIKI_TABLE.lastIndex = 0;
  while ((match = RE_WIKI_TABLE.exec(source)) !== null) {
    if (match.index > last) {
      parts.push(renderBlockWikitext(source.slice(last, match.index)));
    }
    parts.push(renderPreviewTable(match[0]));
    last = match.index + match[0].length;
  }

  if (last < source.length) parts.push(renderBlockWikitext(source.slice(last)));
  return parts.join("");
}
