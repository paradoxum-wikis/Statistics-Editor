import { formulaSourceTip } from "$lib/towerTable";
import { getFncValue } from "$lib/neowtext/functions";
import { getCostKeys } from "$lib/neowtext/functions/keys";
import {
	buildBranchMap,
	getSchemaIndex,
	parseLevelBranch,
	parseLevelNumber,
	parseSchema,
	resolveBranchSpec,
	schemaIndexToLevel,
} from "$lib/neowtext/functions/schema";
import {
	isNumericArrayBody,
	seriesIndicesThroughLevel,
} from "$lib/neowtext/functions/total";
import { stripRefs } from "$lib/utils/format";
import { wikiTemplateKey, wikiTemplateRe } from "$lib/wikiTemplates";

export type CellVarKind = "array" | "scalar" | "formula" | "ref";

export type CellVar = {
	token: string;
	def: string;
	kind: CellVarKind;
	parts?: string[];
	slotLabels?: string[];
	slot?: number;
	pin?: string;
	viaTotal?: boolean;
	used?: boolean[];
};

export type CellInspection = {
	source: string;
	expanded: string | null;
	vars: CellVar[];
	inputs: string[];
};

export function levelValFor(
	row: Record<string, unknown> | null | undefined,
	rowIdx: number,
	branchSuffix = "",
): string {
	return row && row.Level !== undefined
		? `${row.Level}${branchSuffix}`
		: `${rowIdx}${branchSuffix}`;
}

function slotLabelAt(schema: string[] | null, idx: number): string {
	if (idx < 0) return "?";
	const { level, branch } = schemaIndexToLevel(schema, idx);
	return idx === 0 ? "Base" : `Upg ${level}${schema ? branch : ""}`;
}

function arraySlotIndex(
	tokens: Record<string, string>,
	levelVal: string,
	variantPrefix?: string,
): { schema: string[] | null; idx: number } {
	const schema = parseSchema(getFncValue(tokens, "SCHEMA"));
	const branch = resolveBranchSpec(
		parseLevelBranch(levelVal),
		buildBranchMap(tokens, variantPrefix),
	);
	return {
		schema,
		idx: getSchemaIndex(schema, parseLevelNumber(levelVal), branch),
	};
}

function classifyVar(
	token: string,
	def: string,
	tokens: Record<string, string>,
	levelVal: string,
	variantPrefix?: string,
): CellVar {
	const stripped = stripRefs(def).trim();
	if (/<ref\b/i.test(def) && !stripped) return { token, def, kind: "ref" };

	if (stripped.includes(";") && isNumericArrayBody(stripped)) {
		const { schema, idx } = arraySlotIndex(tokens, levelVal, variantPrefix);
		const parts = stripped.split(";").map((s) => s.trim());
		return {
			token,
			def,
			kind: "array",
			parts,
			slotLabels: parts.map((_, i) => slotLabelAt(schema, i)),
			slot: idx >= 0 && idx < parts.length ? idx : undefined,
		};
	}

	if (/^-?[\d.,]+$/.test(stripped)) return { token, def, kind: "scalar" };

	return { token, def, kind: "formula" };
}

const VAR_RE = /\$([^$]+)\$/g;

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseOcc(inner: string): {
	token: string;
	pin?: string;
	levelVal?: string;
} {
	const m = inner.match(/^([^@]+)(?:@(\d+)(?:@(.+))?)?$/);
	if (!m) return { token: `$${inner.split("@")[0]}$` };
	if (m[2] === undefined) return { token: `$${m[1]}$` };
	const pin = m[3] ? `@${m[2]}@${m[3]}` : `@${m[2]}`;
	return { token: `$${m[1]}$`, pin, levelVal: `${m[2]}${m[3] ?? ""}` };
}

export function tokenInCell(raw: string, token: string): boolean {
	const base = token.replace(/^\$|\$$/g, "").split("@")[0];
	if (!base) return false;
	return new RegExp(`\\$${escapeRe(base)}(?:@[^$]*)?\\$`).test(raw);
}

function cellUsesArrayToken(
	raw: string,
	arrayToken: string,
	tokens: Record<string, string>,
): boolean {
	if (tokenInCell(raw, arrayToken)) return true;
	for (const m of raw.matchAll(VAR_RE)) {
		const tok = `$${m[1].split("@")[0]}$`;
		const def = tokens[tok];
		if (typeof def === "string" && tokenInCell(def, arrayToken)) return true;
	}
	return false;
}

export function arraySlotUse(
	v: CellVar,
	tokens: Record<string, string>,
	rowLevels: number[],
	columnRaws: string[],
	branchSuffix = "",
): boolean[] {
	const parts = v.parts ?? [];
	const schema = parseSchema(getFncValue(tokens, "SCHEMA"));
	const trunk = schema?.[0] || "N";
	const tableBranch = branchSuffix || trunk;
	return parts.map((_, i) => {
		const { level, branch } = schemaIndexToLevel(schema, i);
		const slotBranch = schema ? branch : tableBranch;
		if (slotBranch !== tableBranch) return false;
		const rowIdx = rowLevels.findIndex((lv) => lv === level);
		if (rowIdx < 0) return false;
		return cellUsesArrayToken(columnRaws[rowIdx] ?? "", v.token, tokens);
	});
}

function followSpecial(
	token: string,
	tokens: Record<string, string>,
	variantPrefix?: string,
): string | undefined {
	const m = token.slice(1, -1).match(/^(?:FNC|FSE)-(?:PVP-)?(.+)$/i);
	if (!m) return;
	const rest = m[1];
	if (/^TOTALPRICE$/i.test(rest) || /^TOTAL-COST$/i.test(rest))
		return getCostKeys(variantPrefix).find((k) => tokens[k] !== undefined);
	const total = rest.match(/^TOTAL-(.+)$/i);
	if (!total) return;
	const name = total[1];
	return [
		variantPrefix && `$${variantPrefix}-${name}$`,
		`$${name}$`,
		`$FNC-${name}$`,
		variantPrefix && `$FNC-${variantPrefix}-${name}$`,
	].find((k): k is string => !!k && tokens[k] !== undefined);
}

function collectVars(
	text: string,
	tokens: Record<string, string>,
	levelVal: string,
	variantPrefix?: string,
): CellVar[] {
	const vars: CellVar[] = [];
	const seen = new Set<string>();
	const visit = (src: string, depth: number, allowPin: boolean) => {
		if (depth > 6) return;
		for (const m of src.matchAll(VAR_RE)) {
			const occ = parseOcc(m[1]);
			let token = occ.token;
			let slotLevel = levelVal;
			let pin = allowPin ? occ.pin : undefined;
			let followed = false;
			if (typeof tokens[token] !== "string") {
				const mapped = followSpecial(token, tokens, variantPrefix);
				if (!mapped) continue;
				token = mapped;
				pin = undefined;
				slotLevel = levelVal;
				followed = true;
			} else if (pin && occ.levelVal) {
				slotLevel = occ.levelVal;
			}
			if (seen.has(token) || typeof tokens[token] !== "string") continue;
			seen.add(token);
			const v = classifyVar(
				token,
				tokens[token],
				tokens,
				slotLevel,
				variantPrefix,
			);
			if (pin) v.pin = pin;
			if (v.kind === "array" && followed && !tokenInCell(text, token)) {
				v.viaTotal = true;
			}
			vars.push(v);
			if (v.kind === "formula") visit(v.def, depth + 1, false);
		}
	};
	visit(text, 0, true);
	return vars;
}

export function formatCellHold(
	raw: string | number | undefined,
	wrap: string | null,
	recursion: boolean,
	recursionOnly = false,
	recToken = "",
): string {
	if (recursionOnly) return recToken;
	let inner = raw == null ? "" : String(raw).trim();
	if (wrap) inner = `{{${wrap}|${inner}}}`;
	if (recursion && recToken && !inner.includes(recToken)) inner += recToken;
	return inner;
}

export function parseCellHold(text: string): {
	wrap: string | null;
	inner: string;
} {
	const s = text.trim();
	const m = wikiTemplateRe().exec(s);
	if (!m || m.index !== 0) return { wrap: null, inner: s };
	const name = m[1].trim();
	if (!wikiTemplateKey(name)) return { wrap: null, inner: s };
	return { wrap: name, inner: m[2].trim() + s.slice(m[0].length) };
}

export function resolveEditHold(
	text: string,
	prevWrap: string | null | undefined,
	restoreWrap: boolean,
): { wrap: string | null; inner: string } {
	const parsed = parseCellHold(text);
	if (parsed.wrap || !restoreWrap || !prevWrap) return parsed;
	return { wrap: prevWrap, inner: parsed.inner };
}

export function applyCellWrap(
	wrapCells: Record<string, string>[],
	moneyCells: string[][] | undefined,
	rowIdx: number,
	header: string,
	wrap: string | null,
) {
	while (wrapCells.length <= rowIdx) wrapCells.push({});
	if (wrap) wrapCells[rowIdx][header] = wrap;
	else delete wrapCells[rowIdx][header];

	if (!moneyCells) return;
	while (moneyCells.length <= rowIdx) moneyCells.push([]);
	const list = moneyCells[rowIdx];
	const i = list.indexOf(header);
	if (wikiTemplateKey(wrap) === "Money") {
		if (i < 0) list.push(header);
	} else if (i >= 0) list.splice(i, 1);
}

const QUALIFIED_NAME_RE = /\b[A-Za-z][A-Za-z0-9_ ]*\.[A-Za-z0-9_ ]+/g;

/**
 * Column headers referenced by an expanded formula, longest-first greedy
 * so e.g. "Total Cost" wins over "Cost".
 */
export function collectInputs(text: string, headers: string[]): string[] {
	const cleaned = text.replace(QUALIFIED_NAME_RE, " ");
	const spans: [number, number][] = [];
	const found = new Map<string, number>();

	for (const header of headers) {
		const name = stripRefs(header).trim();
		if (!name || name.toLowerCase() === "level") continue;
		const re = new RegExp(`\\b${escapeRe(name)}\\b`, "gi");
		for (const m of cleaned.matchAll(re)) {
			const start = m.index!;
			const end = start + m[0].length;
			if (spans.some(([a, b]) => start < b && a < end)) continue;
			spans.push([start, end]);
			if (!found.has(name)) found.set(name, start);
		}
	}

	return [...found.keys()].sort((a, b) => found.get(a)! - found.get(b)!);
}

export type InspectCtx = {
	columnRaws?: string[];
	rowLevels?: number[];
	branchSuffix?: string;
};

export function inspectCell(
	rawValue: string | number | undefined,
	tokens: Record<string, string>,
	headers: string[],
	levelVal: string,
	variantPrefix?: string,
	ctx?: InspectCtx,
): CellInspection | null {
	if (typeof rawValue !== "string") return null;
	const source = stripRefs(rawValue).trim();
	if (!/\$[^$]+\$/.test(source) && !/{{#expr:/i.test(source)) return null;

	const expanded = formulaSourceTip(rawValue, tokens);
	const vars = collectVars(rawValue, tokens, levelVal, variantPrefix);
	for (const v of vars) {
		if (v.kind !== "array" || !v.parts) continue;
		if (v.viaTotal) {
			v.used = seriesIndicesThroughLevel(
				v.parts.length,
				levelVal,
				tokens,
				ctx?.branchSuffix || parseLevelBranch(levelVal) || undefined,
				buildBranchMap(tokens, variantPrefix),
			);
		} else if (ctx?.columnRaws && ctx.rowLevels) {
			v.used = arraySlotUse(
				v,
				tokens,
				ctx.rowLevels,
				ctx.columnRaws,
				ctx.branchSuffix,
			);
		}
	}

	return {
		source,
		expanded,
		vars,
		inputs: collectInputs(expanded ?? source, headers),
	};
}
