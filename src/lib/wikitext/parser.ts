export interface TableData {
  headers: string[];
  rows: Record<string, string | number>[];
}

export interface ParsedWikitext {
  variables: Record<string, string>;
  tabs: Record<string, TableData>;
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
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "") // remove paired refs
    .replace(/<ref\b[^>]*\/>/gi, ""); // remove self-closing refs

/**
 * Parses wikitext content into variables and tabbed tables.
 */
export function parseWikitext(content: string): ParsedWikitext {
  const variables: Record<string, string> = {};
  const tabs: Record<string, TableData> = {};
  let text = content.replace(/\r\n/g, "\n");

  const blockVariableRegex = /<variable>([\s\S]*?)<\/variable>/g;
  let blockMatch;
  while ((blockMatch = blockVariableRegex.exec(text)) !== null) {
    const blockContent = blockMatch[1];
    const lines = blockContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split("=");
      if (parts.length < 2) continue;
      const key = parts[0].trim();
      let value = parts.slice(1).join("=").trim();

      if (
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

      const tableData = parseTable(tabContent);
      if (tableData) {
        tabs[tabName] = tableData;
      }
    }
  } else {
    const tableData = parseTable(text);
    if (tableData) {
      tabs["Default"] = tableData;
    }
  }

  return { variables, tabs };
}

/**
 * Parses a table from wikitext into headers and rows.
 */
function parseTable(content: string): TableData | null {
  const tableRegex = /\{\|[\s\S]*?\|\}/;
  const match = content.match(tableRegex);

  if (!match) return null;

  const tableContent = match[0];
  const lines = tableContent.split("\n");

  const headers: string[] = [];
  const rows: Record<string, string | number>[] = [];

  let currentRow: Record<string, string | number> = {};
  let colIdx = 0;

  const cleanCell = (val: string): string | number => {
    val = val.trim();
    val = stripRefs(val);
    const moneyMatch = val.match(/{{Money\|([0-9,.]+)}}/);
    if (moneyMatch) {
      val = moneyMatch[1];
    }
    const cleanVal = val.replace(/,/g, "");
    if (!isNaN(Number(cleanVal)) && cleanVal !== "") {
      return Number(cleanVal);
    }
    return val;
  };

  const cleanHeader = (val: string): string => {
    return String(cleanCell(val));
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
          currentRow[headers[colIdx]] = cleanCell(part);
        }
        colIdx++;
      }
      continue;
    }
  }

  if (Object.keys(currentRow).length > 0) {
    rows.push(currentRow);
  }

  return { headers, rows };
}
