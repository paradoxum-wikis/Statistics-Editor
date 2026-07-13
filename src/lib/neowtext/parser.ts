import { stripRefs } from "$lib/utils/format";
import { stripDirectives } from "./directives";

export interface TableData {
  name: string;
  headers: string[];
  rawHeaders: string[];
  rows: Record<string, string | number>[];
  moneyColumns: string[];
  readOnlyColumns: string[];
  cellFormulaTokens?: Record<string, Record<string, string>>;
  branchSuffix?: string;
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
  let text = stripDirectives(content.replace(/\r\n/g, "\n"));

  if (!/<var\b/i.test(text) && /<\/var>/i.test(text)) {
    const closeIdx = text.search(/<\/var>/i);
    const beforeClose = closeIdx >= 0 ? text.slice(0, closeIdx) : "";
    if (/\$[^=\n]+\$\s*=/.test(beforeClose)) {
      text = `<var>\n${text}`;
    }
  }

  const blockVariableRegex = /<var\b[^>]*>([\s\S]*?)<\/var>/gi;
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

  // $FNC-* / $FSE-* and Table.Col refs are left for per row resolution
  const keys = Object.keys(variables);
  if (keys.length > 0) {
    const replacer = createVariableReplacer(variables);
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const k of keys) {
        const v = variables[k];
        if (v.includes("$")) {
          const next = replacer(v);
          if (next !== v) {
            variables[k] = next;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
  }

  const applyVariables = createVariableReplacer(variables);
  const tabberMatch = text.match(
    /<div[^>]*class=["'][^"']*mobile-tabber[^"']*["'][^>]*>\s*<tabber>([\s\S]*?)<\/tabber>/i,
  );
  const luaTabberMatch = extractLuaTabber(text);

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
  } else if (luaTabberMatch.length > 0) {
    for (const { tabName, tabContent } of luaTabberMatch) {
      const resolvedTabName = applyVariables(tabName.trim());
      const tables = parseTables(tabContent.trim(), applyVariables);
      if (tables.length > 0) tabs[resolvedTabName] = tables;
    }
  } else {
    const tables = parseTables(text, applyVariables);
    if (tables.length > 0) tabs["Regular"] = tables;
  }

  return { variables, tabs };
}

function extractLuaTabber(
  text: string,
): Array<{ tabName: string; tabContent: string }> {
  const mobileMatch =
    /<div[^>]*class=["'][^"']*mobile-tabber[^"']*["'][^>]*>/i.exec(text);
  if (!mobileMatch || mobileMatch.index === undefined) return [];

  const searchStart = mobileMatch.index + mobileMatch[0].length;
  const tabberStart = text.slice(searchStart).search(/\{\{\s*Tabber\b/i);
  if (tabberStart === -1) return [];

  const absoluteStart = searchStart + tabberStart;
  const template = extractBalancedTemplate(text, absoluteStart);
  if (!template) return [];

  const content = template
    .replace(/^\{\{\s*Tabber\b/i, "")
    .replace(/\}\}\s*$/, "");
  const lines = content.split("\n");
  const result: Array<{ tabName: string; tabContent: string }> = [];

  let currentTabName: string | null = null;
  let currentTabContent: string[] = [];

  const pushCurrentTab = () => {
    if (!currentTabName) return;
    const joined = currentTabContent.join("\n").trim();
    if (!joined) return;
    result.push({ tabName: currentTabName, tabContent: joined });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    let nextLine = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim()) {
        nextLine = lines[j].trim();
        break;
      }
    }

    const value = trimmed.startsWith("|") ? trimmed.slice(1).trim() : "";
    const isTabName =
      value !== "" &&
      !value.includes("=") &&
      !value.startsWith("-") &&
      !value.startsWith("<") &&
      !value.startsWith("{|") &&
      !value.includes("||") &&
      nextLine.startsWith("|") &&
      !nextLine.startsWith("|-");

    if (isTabName) {
      pushCurrentTab();
      currentTabName = value;
      currentTabContent = [];
      continue;
    }

    if (currentTabName) currentTabContent.push(line);
  }

  pushCurrentTab();
  return result;
}

function extractBalancedTemplate(
  text: string,
  startIndex: number,
): string | null {
  let depth = 0;
  for (let i = startIndex; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === "{{") {
      depth++;
      i++;
      continue;
    }
    if (pair === "}}") {
      depth--;
      i++;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
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
  const name = extractTableName(lines);
  const headers: string[] = [];
  const rawHeaders: string[] = [];
  const rows: Record<string, string | number>[] = [];
  const recursionState: Record<number, string> = {};

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

    if (!/\$[^$]+\$/.test(stripRefs(val).trim())) {
      val = applyVariables(val);
    }

    const cleanVal = val.replace(/,/g, "");
    if (!isNaN(Number(cleanVal)) && cleanVal !== "") return Number(cleanVal);
    return val;
  };

  const cleanHeader = (val: string): string => {
    const expanded = applyVariables(val);
    return stripRefs(
      String(cleanCell(expanded, undefined)).replace(/\$[A-Z0-9_-]+\$/gi, ""),
    ).trim();
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
      for (const part of line.substring(1).split(/!!|\|\|/)) {
        rawHeaders.push(part.trim());
        headers.push(cleanHeader(part));
      }
      continue;
    }

    if (line.startsWith("|")) {
      if (line.startsWith("|-") || line.startsWith("|}")) continue;
      for (let part of line.substring(1).split("||")) {
        const header = headers[colIdx];
        if (header) {
          let hasRecursion = false;
          let isOnlyRecursion = false;
          let cleanPart = part;

          const tokens = part.match(/\$[^$\s]+\$/g) || [];
          for (const t of tokens) {
            if (applyVariables(t).trim() === "$FNC-RECURSION$") {
              hasRecursion = true;
              if (part.trim() === t) isOnlyRecursion = true;
              cleanPart = cleanPart.replace(t, "");
            }
          }

          if (hasRecursion) {
            if (isOnlyRecursion && recursionState[colIdx] !== undefined) {
              part = recursionState[colIdx];
            } else {
              recursionState[colIdx] = cleanPart;
              part = cleanPart;
            }
          } else {
            delete recursionState[colIdx];
          }

          currentRow[header] = cleanCell(part, header);
        }
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
