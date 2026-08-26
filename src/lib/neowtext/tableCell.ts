import { formatCellHold } from "$lib/cellInspect";
import { createVariableReplacer, parseTable, type TableData } from "./parser";
import { serializeTable } from "./serializer";

export type TableEvalState = {
	name: string;
	headers: string[];
	rawHeaders?: string[];
	rows: Record<string, string | number>[];
	wrapCells: Record<string, string>[];
	wikiCells?: Record<string, string>[];
	recursionCells: string[][];
	recursionOnlyCells: string[][];
	recursionTokens: Record<string, string>[];
	cellFormulaTokens: Record<string, Record<string, string>>;
};

export function cftFromRows(
	rows: Record<string, string | number>[],
): Record<string, Record<string, string>> {
	const cft: Record<string, Record<string, string>> = {};
	for (let i = 0; i < rows.length; i++) {
		const rec: Record<string, string> = {};
		for (const [k, v] of Object.entries(rows[i])) {
			if (typeof v !== "string") continue;
			if (/\$[^$]+\$/.test(v) || /^{{#expr:/i.test(v)) rec[k] = v;
		}
		if (Object.keys(rec).length) cft[String(i)] = rec;
	}
	return cft;
}

export function rewriteCell(
	state: TableEvalState,
	rowIdx: number,
	header: string,
	text: string,
	tokens: Record<string, string>,
): TableData {
	const sources = state.rows.map((row, i) => {
		const out: Record<string, string | number> = {
			...row,
			...(state.cellFormulaTokens[String(i)] ?? {}),
		};
		for (const h of state.headers) {
			if (h === "Level") continue;
			out[h] =
				state.wikiCells?.[i]?.[h] ??
				formatCellHold(
					out[h],
					state.wrapCells[i]?.[h] ?? null,
					state.recursionCells[i]?.includes(h) === true,
					state.recursionOnlyCells[i]?.includes(h) === true,
					state.recursionTokens[i]?.[h] ?? "",
				);
		}
		return out;
	});
	sources[rowIdx][header] = text;
	const parsed = parseTable(
		serializeTable({
			Headers: state.headers,
			RawHeaders: state.rawHeaders,
			RawRows: sources,
			Name: state.name,
		}),
		createVariableReplacer(tokens),
	);
	if (!parsed) throw new Error("rewriteCell: parseTable failed");
	return parsed;
}
