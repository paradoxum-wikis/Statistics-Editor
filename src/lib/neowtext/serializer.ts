interface TableRow extends Record<string, string | number | boolean | object> {}

interface SkinDataJSON {
  Headers: string[];
  RawHeaders?: string[];
  RawRows: TableRow[];
  MoneyColumns?: string[];
  Name?: string;
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
      const s = String(val).trim();
      const formatted =
        typeof val === "number"
          ? formatMoneyNumber(val)
          : s === ""
            ? ""
            : /[.,]/.test(s)
              ? s
              : Number.isFinite(+s)
                ? formatMoneyNumber(+s)
                : s;
      strVal = `{{Money|${formatted}}}`;
    }

    parts.push(strVal);
  }

  return `| ${parts.join(" || ")}`;
}

export function serializeTable(data: SkinDataJSON): string {
  const { Headers, RawHeaders, RawRows, MoneyColumns = [], Name = "" } = data;
  if (!Headers || !RawRows) return "";

  const lines: string[] = [];

  lines.push(`{| class="wikitable stats-table"`);

  if (Name) {
    lines.push(`! colspan="${Headers.length}" |${Name}`);
    lines.push("|-");
  }

  lines.push(`! ${(RawHeaders?.length ? RawHeaders : Headers).join(" !! ")}`);

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
