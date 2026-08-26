import { settingsStore } from "$lib/stores/settings.svelte";
import { formatNumber } from "$lib/utils/format";
import { formatsWikiNumber } from "$lib/wikiTemplates";

interface TableRow extends Record<string, string | number | boolean | object> {}

interface SkinDataJSON {
	Headers: string[];
	RawHeaders?: string[];
	RawRows: TableRow[];
	MoneyCells?: string[][];
	RecursionCells?: string[][];
	RecursionOnlyCells?: string[][];
	RecursionTokens?: Record<string, string>[];
	WrapCells?: Record<string, string>[];
	WikiCells?: Record<string, string>[];
	Name?: string;
}

function formatTemplateNumber(n: number): string {
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
	recursionHeaders: string[],
	recursionOnlyHeaders: string[],
	recursionTokens: Record<string, string>,
	wraps: Record<string, string>,
	wiki: Record<string, string>,
): string {
	const parts: string[] = [];

	for (const header of headers) {
		if (wiki[header] !== undefined) {
			parts.push(normalizeCellLineBreaks(wiki[header]));
			continue;
		}
		let val = row[header];

		if (val === undefined || val === null) {
			val = "";
		}

		if (typeof val === "object") {
			val = JSON.stringify(val);
		}

		let strVal = normalizeCellLineBreaks(String(val));

		if (recursionOnlyHeaders.includes(header)) {
			parts.push(recursionTokens[header]);
			continue;
		}

		const wrap = wraps[header];
		if (wrap) {
			if (formatsWikiNumber(wrap)) {
				const s = String(val).trim();
				const formatted =
					typeof val === "number"
						? formatTemplateNumber(val)
						: s === ""
							? ""
							: /[.,]/.test(s)
								? s
								: Number.isFinite(+s)
									? formatTemplateNumber(+s)
									: s;
				strVal = normalizeCellLineBreaks(formatted);
			}
			strVal = `{{${wrap}|${strVal}}}`;
		}

		if (recursionHeaders.includes(header)) strVal += recursionTokens[header];

		parts.push(strVal);
	}

	return `| ${parts.join(" || ")}`;
}

export function serializeTable(data: SkinDataJSON): string {
	const {
		Headers,
		RawHeaders,
		RawRows,
		RecursionCells = [],
		RecursionOnlyCells = [],
		RecursionTokens = [],
		WrapCells = [],
		WikiCells = [],
		Name = "",
	} = data;
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
		recursion: RecursionCells[i] ?? [],
		recursionOnly: RecursionOnlyCells[i] ?? [],
		tokens: RecursionTokens[i] ?? {},
		wraps: WrapCells[i] ?? {},
		wiki: WikiCells[i] ?? {},
	}));
	const sorted = rowsAreLevelSorted(RawRows)
		? paired
		: [...paired].sort(
				(a, b) => Number(a.row["Level"]) - Number(b.row["Level"]),
			);

	for (const { row, recursion, recursionOnly, tokens, wraps, wiki } of sorted) {
		lines.push("|-");
		lines.push(
			serializeRow(row, Headers, recursion, recursionOnly, tokens, wraps, wiki),
		);
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
