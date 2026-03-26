import { settingsStore } from "$lib/stores/settings.svelte";
import { applyROFBug } from "$lib/utils/format";

export interface TableData {
  name: string;
  headers: string[];
  rows: Record<string, string | number>[];
  moneyColumns: string[];
  readOnlyColumns: string[];
}

export interface ParsedWikitext {
  variables: Record<string, string>;
  tabs: Record<string, TableData[]>;
}

/**
 * Strip garbage wiki only reference markup.
 *
 * Currently, it only removes ref tags.
 * This prevents header/value contamination like:
 *   DPS<ref>...</ref>  ->  DPS
 */
const stripRefs = (s: string): string =>
  s
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref\b[^>]*\/>/gi, "");

/**
 * Parses wikitext content into variables and tabbed tables.
 */
export function parseWikitext(content: string): ParsedWikitext {
  const variables: Record<string, string> = {};
  const tabs: Record<string, TableData[]> = {};
  let text = content.replace(/\r\n/g, "\n");

  const blockVariableRegex = /<var>([\s\S]*?)<\/var>/g;
  let blockMatch;
  while ((blockMatch = blockVariableRegex.exec(text)) !== null) {
    const blockContent = blockMatch[1];
    const lines = blockContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split("=");
      if (parts.length < 2) continue;
      const key = parts[0].trim();
      let value = parts.slice(1).join("=").trim();

      if (
        (value.startsWith('"') && !value.endsWith('"')) ||
        (value.startsWith("'") && !value.endsWith("'"))
      ) {
        const quoteChar = value[0];
        let collected = value.substring(1);
        let foundClosing = false;
        while (i + 1 < lines.length) {
          i++;
          const nextLine = lines[i];

          collected += "\n" + nextLine;
          if (nextLine.trim().endsWith(quoteChar)) {
            const lastIdx = collected.lastIndexOf(quoteChar);
            if (lastIdx !== -1) {
              collected = collected.substring(0, lastIdx);
            }
            foundClosing = true;
            break;
          }
        }
        if (foundClosing) {
          value = collected;
        } else {
          value = quoteChar + collected;
        }
      } else if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1);
      }

      value = stripRefs(value).trim();

      variables[key] = value;
    }
  }

  const tabberRegex = /<tabber>([\s\S]*?)<\/tabber>/;
  const tabberMatch = text.match(tabberRegex);

  if (tabberMatch) {
    const tabberContent = tabberMatch[1];
    const parts = tabberContent.split("|-|");

    for (const part of parts) {
      if (!part.trim()) continue;

      const splitIndex = part.indexOf("=");
      if (splitIndex === -1) continue;

      const tabName = part.substring(0, splitIndex).trim();
      const tabContent = part.substring(splitIndex + 1).trim();

      const tables = parseTables(tabContent);
      if (tables.length > 0) {
        tabs[tabName] = tables;
      }
    }
  } else {
    const tables = parseTables(text);
    if (tables.length > 0) {
      tabs["Regular"] = tables;
    }
  }

  return { variables, tabs };
}

/**
 * Extracts the table name from a colspan header row.
 * Looks for `! colspan="N" |Table Name` patterns.
 */
function extractTableName(lines: string[]): string {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("!")) continue;

    const colspanMatch = trimmed.match(/!\s*colspan\s*=\s*"?\d+"?\s*\|(.+)/i);
    if (colspanMatch) {
      return stripRefs(colspanMatch[1]).trim();
    }
  }
  return "";
}

/**
 * Parses all tables from a block of wikitext content.
 */
function parseTables(content: string): TableData[] {
  const results: TableData[] = [];
  const tableRegex = /\{\|[\s\S]*?\|\}/g;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableData = parseTable(match[0]);
    if (tableData) {
      results.push(tableData);
    }
  }

  return results;
}

/**
 * Parses a single table block (from {| to |}) into headers and rows.
 */
function parseTable(tableContent: string): TableData | null {
  const lines = tableContent.split("\n");

  const name = extractTableName(lines);
  const headers: string[] = [];
  const rows: Record<string, string | number>[] = [];

  let currentRow: Record<string, string | number> = {};
  let colIdx = 0;

  const moneyColumns = new Set<string>();

  const cleanCell = (val: string, header?: string): string | number => {
    val = val.trim();
    val = val.replace(/<br\s*\/?>/gi, "\n");
    const templateMatch = val.match(/{{([^|{}]+)\|([^}]+)}}/);
    if (templateMatch) {
      if (templateMatch[1].trim() === "Money" && header)
        moneyColumns.add(header);
      val = templateMatch[2].trim();
    }

    const cleanVal = val.replace(/,/g, "");
    if (!isNaN(Number(cleanVal)) && cleanVal !== "") {
      return Number(cleanVal);
    }
    return val;
  };

  const cleanHeader = (val: string): string => {
    return String(cleanCell(val, undefined));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("{|")) continue;
    if (line.startsWith("|}")) continue;

    if (line.startsWith("|-")) {
      if (Object.keys(currentRow).length > 0) {
        rows.push(currentRow);
      }
      currentRow = {};
      colIdx = 0;
      continue;
    }

    if (line.startsWith("!")) {
      if (/colspan/i.test(line)) {
        continue;
      }

      const headerParts = line.substring(1).split("!!");
      for (const part of headerParts) {
        headers.push(cleanHeader(part));
      }
      continue;
    }

    if (line.startsWith("|")) {
      if (line.startsWith("|-") || line.startsWith("|}")) continue;

      const cellParts = line.substring(1).split("||");
      for (const part of cellParts) {
        if (headers[colIdx]) {
          currentRow[headers[colIdx]] = cleanCell(part, headers[colIdx]);
        }
        colIdx++;
      }
      continue;
    }
  }

  if (Object.keys(currentRow).length > 0) {
    rows.push(currentRow);
  }

  if (headers.length === 0) return null;

  return {
    name,
    headers,
    rows,
    moneyColumns: Array.from(moneyColumns),
    readOnlyColumns: [],
  };
}

export function applyROFBugToTabs(
  tabs: Record<string, TableData[]>,
  variables: Record<string, string>,
): Record<string, TableData[]> {
  const cols = variables["$FNC-ROFBUG$"]?.split(";").map((s) => s.trim());
  if (!cols) return tabs;

  return Object.fromEntries(
    Object.entries(tabs).map(([tab, tables]) => [
      tab,
      tables.map((t) => ({
        ...t,
        rows: t.rows.map((row) => {
          const r = { ...row };
          for (const col of cols) {
            const n = Number(r[col]);
            if (r[col] !== "" && !isNaN(n)) r[col] = applyROFBug(n);
          }
          return r;
        }),
      })),
    ]),
  );
}
