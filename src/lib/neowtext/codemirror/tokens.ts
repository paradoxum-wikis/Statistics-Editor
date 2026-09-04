export type RefKind = "var" | "fnc" | "fse";

export interface DollarRef {
	from: number;
	to: number;
	inner: string;
	base: string;
	kind: RefKind;
	prefix?: "FNC" | "FSE";
	name?: string;
	tab?: string;
	pinLevel?: number;
	pinBranch?: string;
	pinError?: string;
	empty: boolean;
}

export const FNC_NAMES = new Set([
	"COST",
	"BRANCH",
	"INDEX",
	"RECURSION",
	"ROFBUG",
	"ROFBUG-2019",
	"ROFBUG-2020",
	"ROFBUG-2022",
	"SCHEMA",
	"TOTALPRICE",
]);

export const FSE_NAMES = new Set([
	"CATEGORY",
	"DETECTION",
	"META",
	"UPGRADE",
	"UPGRADEICON",
]);

const COMPAT_FSE = new Set(["DETECTION", "UPGRADE", "UPGRADEICON"]);
const TOTAL_NAME = /^TOTAL-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const PIN = /^(.*)@(\d+)(?:@(.+))?$/;

export function isKnownFn(prefix: "FNC" | "FSE", name: string): boolean {
	const upper = name.toUpperCase();
	if (prefix === "FSE") return FSE_NAMES.has(upper);
	if (FNC_NAMES.has(upper) || TOTAL_NAME.test(upper)) return true;
	return COMPAT_FSE.has(upper);
}

function spaces(s: string): string {
	return s.replace(/[^\n]/g, " ");
}

let maskedSrc = "";
let maskedOut = "";

function maskIgnored(text: string): string {
	if (text === maskedSrc) return maskedOut;
	let out = text.replace(/<!--[\s\S]*?-->/g, spaces);
	out = out.replace(/<nowiki\b[^>]*>[\s\S]*?<\/nowiki>/gi, spaces);
	const comment = out.indexOf("<!--");
	if (comment >= 0) out = out.slice(0, comment) + spaces(out.slice(comment));
	const nowiki = out.search(/<nowiki\b/i);
	if (nowiki >= 0) out = out.slice(0, nowiki) + spaces(out.slice(nowiki));
	maskedSrc = text;
	maskedOut = out;
	return out;
}

export function parseRef(from: number, to: number, inner: string): DollarRef {
	const empty = inner.trim() === "";
	let base = inner;
	let pinLevel: number | undefined;
	let pinBranch: string | undefined;
	let pinError: string | undefined;

	if (inner.includes("@")) {
		const pin = PIN.exec(inner);
		if (pin?.[1]) {
			base = pin[1];
			pinLevel = Number(pin[2]);
			if (pin[3] !== undefined) pinBranch = pin[3];
		} else {
			pinError = "pin must be @N or @N@branch";
		}
	}

	let kind: RefKind = "var";
	let prefix: "FNC" | "FSE" | undefined;
	let name: string | undefined;
	let tab: string | undefined;

	const fn = /^(FNC|FSE)-(.+)$/i.exec(base);
	if (fn) {
		prefix = fn[1].toUpperCase() as "FNC" | "FSE";
		let rest = fn[2];
		if (!isKnownFn(prefix, rest)) {
			const split = rest.indexOf("-");
			if (split > 0) {
				const maybe = rest.slice(0, split);
				if (
					/^[A-Za-z0-9]+$/.test(maybe) &&
					isKnownFn(prefix, rest.slice(split + 1))
				) {
					tab = maybe;
					rest = rest.slice(split + 1);
				}
			}
		}
		name = rest;
		kind = prefix === "FSE" ? "fse" : "fnc";
	}

	return {
		from,
		to,
		inner,
		base,
		kind,
		prefix,
		name,
		tab,
		pinLevel,
		pinBranch,
		pinError,
		empty,
	};
}

export function deprecatedFn(ref: DollarRef): string | undefined {
	if (ref.kind !== "fnc" && ref.kind !== "fse") return;
	const n = ref.name!.toUpperCase();
	const tab = ref.tab ? `${ref.tab}-` : "";
	if (ref.kind === "fse" && n === "CATEGORY") {
		return `$FSE-${tab}CATEGORY$ is deprecated; use $FSE-${tab}META$.`;
	}
	if (ref.kind === "fnc" && n === "COST") {
		return `$FNC-${tab}COST$ is deprecated; use array variables such as $${tab}COST$.`;
	}
	if (ref.kind === "fnc" && n === "TOTALPRICE") {
		return `$FNC-TOTALPRICE$ is deprecated; use the generic TOTAL function such as $FNC-TOTAL-${tab}COST$.`;
	}
	if (ref.kind === "fnc" && COMPAT_FSE.has(n)) {
		return `$FNC-${tab}${n}$ is deprecated; use $FSE-${tab}${n}$.`;
	}
}

export const DOT_RE = /([a-zA-Z_][a-zA-Z0-9_ ]*)\.([a-zA-Z_][a-zA-Z0-9_ ]*)/g;

// File: notation matches the engine Table.Col regex
export function imageCol(col: string): boolean {
	return /^(png|jpe?g|gif|webp|svg)$/i.test(col.trim());
}

function hitAt<T extends { from: number; to: number }>(
	text: string,
	pos: number,
	scan: (line: string) => T[],
): T | null {
	const start = text.lastIndexOf("\n", pos - 1) + 1;
	const nl = text.indexOf("\n", pos);
	const line = text.slice(start, nl < 0 ? text.length : nl);
	const local = pos - start;
	for (const hit of scan(line)) {
		if (local >= hit.from && local <= hit.to) {
			return { ...hit, from: hit.from + start, to: hit.to + start };
		}
	}
	return null;
}

export function scanDots(text: string): DollarRef[] {
	const masked = maskIgnored(text).replace(/\$[^$\n]*\$/g, spaces);
	const out: DollarRef[] = [];
	const re = new RegExp(DOT_RE.source, "g");
	let m: RegExpExecArray | null;
	while ((m = re.exec(masked))) {
		if (imageCol(m[2])) continue;
		out.push(
			parseRef(m.index, m.index + m[0].length, `${m[1].trim()}.${m[2].trim()}`),
		);
	}
	return out;
}

export function dotAt(text: string, pos: number): DollarRef | null {
	return hitAt(text, pos, scanDots);
}

export function refAt(text: string, pos: number): DollarRef | null {
	return hitAt(text, pos, scanDollarRefs);
}

export function scanDollarRefs(text: string): DollarRef[] {
	const masked = maskIgnored(text);
	const refs: DollarRef[] = [];
	const re = /\$([^$\n]*)\$/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(masked))) {
		refs.push(parseRef(m.index, m.index + m[0].length, m[1]));
	}
	return refs;
}

export function scanUnclosedDollars(
	text: string,
): { from: number; to: number }[] {
	const masked = maskIgnored(text);
	const out: { from: number; to: number }[] = [];
	let offset = 0;
	const lines = masked.split("\n");
	for (let li = 0; li < lines.length; li++) {
		const line = lines[li];
		let i = 0;
		while (i < line.length) {
			if (line[i] !== "$") {
				i++;
				continue;
			}
			const close = line.indexOf("$", i + 1);
			if (close < 0) {
				out.push({ from: offset + i, to: offset + line.length });
				break;
			}
			i = close + 1;
		}
		offset += line.length + (li < lines.length - 1 ? 1 : 0);
	}
	return out;
}

function inVarBlock(text: string, pos: number): boolean {
	let openAt = -1;
	for (const tag of scanVarTags(text)) {
		if (tag.from > pos) break;
		openAt = tag.open ? tag.to : -1;
	}
	return openAt >= 0 && pos >= openAt;
}

export function isVarDeclaration(text: string, ref: DollarRef): boolean {
	if (ref.kind !== "var") return false;
	const nl = text.indexOf("\n", ref.from);
	const after = text.slice(ref.to, nl < 0 ? text.length : nl);
	return /^\s*=/.test(after) && inVarBlock(text, ref.from);
}

export function varBinding(text: string, inner: string): string | undefined {
	const key = `$${inner}$`;
	const masked = maskIgnored(text);
	let found: string | undefined;
	const re = /<var\b[^>]*>([\s\S]*?)<\/var>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(masked))) {
		for (const line of m[1].split("\n")) {
			const t = line.trim();
			const eq = t.indexOf("=");
			if (eq < 0) continue;
			if (t.slice(0, eq).trim() === key) found = t.slice(eq + 1).trim();
		}
	}
	return found;
}

export type SeName =
	"se-ignore" | "/se-ignore" | "se-ignore/" | "se-diff" | "se-memo";

export interface SeDirective {
	from: number;
	to: number;
	name: SeName;
	raw: string;
}

export const DIR_RE =
	/@\/se-ignore\b|@se-ignore\/|@se-ignore\b|@se-diff\b|@se-memo\b/gi;

function seName(raw: string): SeName {
	return raw.slice(1).toLowerCase() as SeName;
}

export function scanDirectives(text: string): SeDirective[] {
	const out: SeDirective[] = [];
	const re = new RegExp(DIR_RE.source, "gi");
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		out.push({
			from: m.index,
			to: m.index + m[0].length,
			name: seName(m[0]),
			raw: m[0],
		});
	}
	return out;
}

export function directiveAt(text: string, pos: number): SeDirective | null {
	return hitAt(text, pos, scanDirectives);
}

export function scanVarTags(
	text: string,
): { from: number; to: number; open: boolean }[] {
	const masked = maskIgnored(text);
	const tags: { from: number; to: number; open: boolean }[] = [];
	const re = /<\/?var\b[^>]*>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(masked))) {
		tags.push({
			from: m.index,
			to: m.index + m[0].length,
			open: m[0][1] !== "/",
		});
	}
	return tags;
}
