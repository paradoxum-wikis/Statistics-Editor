import { applyRofBug, stripRefs } from "$lib/utils/format";

export interface TableData {
  name: string;
  headers: string[];
  rawHeaders: string[];
  rows: Record<string, string | number>[];
  moneyColumns: string[];
  readOnlyColumns: string[];
  cellFormulaTokens?: Record<string, Record<string, string>>;
}

export interface ParsedWikitext {
  variables: Record<string, string>;
  tabs: Record<string, TableData[]>;
}

/**
 * Factory that precompiles a single regex to replace all vars in one pass.
 */
function createVariableReplacer(variables: Record<string, string>) {
  const keys = Object.keys(variables).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return (text: string) => text;

  const escapedKeys = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(escapedKeys.join("|"), "g");

  return (text: string) => text.replace(regex, (match) => variables[match]);
}

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
            if (lastIdx !== -1) collected = collected.substring(0, lastIdx);
            foundClosing = true;
            break;
          }
        }
        value = foundClosing ? collected : quoteChar + collected;
      } else if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        if (value.indexOf(value[0], 1) === value.length - 1) {
          value = value.substring(1, value.length - 1);
        }
      }

      variables[key] = value.trim();
    }
  }

  const applyVariables = createVariableReplacer(variables);
  const tabberMatch = text.match(/<tabber>([\s\S]*?)<\/tabber>/);

  if (tabberMatch) {
    for (const part of tabberMatch[1].split("|-|")) {
      if (!part.trim()) continue;

      const splitIndex = part.indexOf("=");
      if (splitIndex === -1) continue;

      const tabName = applyVariables(part.substring(0, splitIndex).trim());
      const tables = parseTables(
        part.substring(splitIndex + 1).trim(),
        applyVariables,
      );
      if (tables.length > 0) tabs[tabName] = tables;
    }
  } else {
    const tables = parseTables(text, applyVariables);
    if (tables.length > 0) tabs["Regular"] = tables;
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
    if (colspanMatch) return colspanMatch[1].trim();
  }
  return "";
}

/**
 * Parses all tables from a block of wikitext content.
 */
function parseTables(
  content: string,
  applyVariables: (text: string) => string,
): TableData[] {
  const results: TableData[] = [];
  const tableRegex = /\{\|[\s\S]*?\|\}/g;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableData = parseTable(match[0], applyVariables);
    if (tableData) results.push(tableData);
  }
  return results;
}

/**
 * Parses a single table block (from {| to |}) into headers and rows.
 */
function parseTable(
  tableContent: string,
  applyVariables: (text: string) => string,
): TableData | null {
  const lines = tableContent.split("\n");
  const name = applyVariables(extractTableName(lines));
  const headers: string[] = [];
  const rawHeaders: string[] = [];
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

    if (!/^\$[^$]+\$$/.test(stripRefs(val).trim())) {
      val = applyVariables(val);
    }

    const cleanVal = val.replace(/,/g, "");
    if (!isNaN(Number(cleanVal)) && cleanVal !== "") return Number(cleanVal);
    return val;
  };

  const cleanHeader = (val: string): string => {
    return applyVariables(stripRefs(String(cleanCell(val, undefined))).trim());
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("{|") || line.startsWith("|}")) continue;

    if (line.startsWith("|-")) {
      if (Object.keys(currentRow).length > 0) rows.push(currentRow);
      currentRow = {};
      colIdx = 0;
      continue;
    }

    if (line.startsWith("!")) {
      if (/colspan/i.test(line)) continue;
      for (const part of line.substring(1).split("!!")) {
        rawHeaders.push(part.trim());
        headers.push(cleanHeader(part));
      }
      continue;
    }

    if (line.startsWith("|")) {
      if (line.startsWith("|-") || line.startsWith("|}")) continue;
      for (const part of line.substring(1).split("||")) {
        if (headers[colIdx])
          currentRow[headers[colIdx]] = cleanCell(part, headers[colIdx]);
        colIdx++;
      }
      continue;
    }
  }

  if (Object.keys(currentRow).length > 0) rows.push(currentRow);
  if (headers.length === 0) return null;

  return {
    name,
    headers,
    rawHeaders,
    rows,
    moneyColumns: Array.from(moneyColumns),
    readOnlyColumns: [],
  };
}
