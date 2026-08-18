import { settingsStore } from "$lib/stores/settings.svelte";
import { formatNumber } from "$lib/utils/format";

interface TableRow extends Record<string, string | number | boolean | object> {}

interface SkinDataJSON {
	Headers: string[];
	RawHeaders?: string[];
	RawRows: TableRow[];
	MoneyCells?: string[][];
	Name?: string;
}

function formatMoneyNumber(n: number): string {
	if (settingsStore.fullPrecision) return formatNumber(n);
	const s = Number.isInteger(n) ? n.toString() : n.toFixed(2);
	return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function normalizeCellLineBreaks(value: string): string {
	return value.replace(/\r?\n/g, "<br/>");
}

function serializeRow(
	row: TableRow,
	headers: string[],
	moneyHeaders: string[],
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

		let strVal = normalizeCellLineBreaks(String(val));

		if (moneyHeaders.includes(header)) {
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
			strVal = `{{Money|${normalizeCellLineBreaks(formatted)}}}`;
		}

		parts.push(strVal);
	}

	return `| ${parts.join(" || ")}`;
}

export function serializeTable(data: SkinDataJSON): string {
	const { Headers, RawHeaders, RawRows, MoneyCells = [], Name = "" } = data;
	if (!Headers || !RawRows) return "";

	const lines: string[] = [];

	lines.push(`{| class="wikitable stats-table"`);

	if (Name) {
		lines.push(`! colspan="${Headers.length}" |${Name}`);
		lines.push("|-");
	}

	lines.push(`! ${(RawHeaders?.length ? RawHeaders : Headers).join(" !! ")}`);

	const paired = RawRows.map((row, i) => ({
		row,
		money: MoneyCells[i] ?? [],
	}));
	const sorted = rowsAreLevelSorted(RawRows)
		? paired
		: [...paired].sort(
				(a, b) => Number(a.row["Level"]) - Number(b.row["Level"]),
			);

	for (const { row, money } of sorted) {
		lines.push("|-");
		lines.push(serializeRow(row, Headers, money));
	}

	lines.push("|}");

	return lines.join("\n");
}

function rowsAreLevelSorted(rows: TableRow[]): boolean {
	let previous = -Infinity;
	for (const row of rows) {
		const current = Number(row["Level"]);
		if (!Number.isFinite(current) || current < previous) return false;
		previous = current;
	}
	return true;
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
