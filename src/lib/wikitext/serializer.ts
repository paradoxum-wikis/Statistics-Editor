interface TableRow extends Record<string, string | number | boolean | object> {}

interface SkinDataJSON {
  Headers: string[];
  RawRows: TableRow[];
  MoneyColumns?: string[];
}

function formatMoneyNumber(n: number): string {
  const s = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function serializeRow(
  row: TableRow,
  headers: string[],
  moneyColumns: string[],
): string {
  const parts: string[] = [];

  for (const header of headers) {
    let val = row[header];

    if (val === undefined || val === null) {
      val = "";
    }

    if (typeof val === "object") {
      val = JSON.stringify(val);
    }

    let strVal = String(val);

    if (moneyColumns.includes(header)) {
      const formatted =
        typeof val === "number" ? formatMoneyNumber(val) : strVal;
      strVal = `{{Money|${formatted}}}`;
    }

    parts.push(strVal);
  }

  return `| ${parts.join(" || ")}`;
}

export function serializeTable(data: SkinDataJSON): string {
  const { Headers, RawRows, MoneyColumns = [] } = data;
  if (!Headers || !RawRows) return "";

  const lines: string[] = [];

  lines.push(`{| class="article-table" style="width:100%"`);
  lines.push(`! ${Headers.join(" !! ")}`);

  const sortedRows = [...RawRows].sort((a, b) => {
    return Number(a["Level"]) - Number(b["Level"]);
  });

  for (const row of sortedRows) {
    lines.push("|-");
    lines.push(serializeRow(row, Headers, MoneyColumns));
  }

  lines.push("|}\n");

  return lines.join("\n");
}

export function serializeVariables(variables: Record<string, string>): string {
  const lines: string[] = [];
  lines.push("<var>");

  for (const [key, val] of Object.entries(variables)) {
    lines.push(`${key} = ${val}`);
  }

  lines.push("</var>");
  return lines.join("\n");
}
