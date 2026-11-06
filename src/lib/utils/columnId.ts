export function stripRefs(s: unknown): string {
	if (s === undefined || s === null) return "";
	return String(s)
		.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
		.replace(/<ref\b[^>]*\/>/gi, "");
}

function compactColumnId(id: string): string {
	return id.replace(/\s+/g, "");
}

export function normalizeColumnKey(s: unknown): string {
	const t = stripRefs(s);
	if (!/[<$[]/.test(t)) return t.trim();
	return t
		.replace(/<[^>]+>/g, "")
		.replace(/</g, "")
		.replace(/>/g, "")
		.replace(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/gi, (_, name: string) =>
			/^(?:file|image)\s*:/i.test(name) ? "" : name,
		)
		.replace(/\[\[|\]\]/g, "")
		.replace(/\$[^$]+\$/g, "")
		.trim();
}

export function findColumnKey(
	record: object,
	name: string,
): string | undefined {
	if (Object.hasOwn(record, name)) return name;
	const id = normalizeColumnKey(name);
	if (!id) return undefined;
	if (id !== name && Object.hasOwn(record, id)) return id;
	const compact = compactColumnId(id);
	if (compact !== id && Object.hasOwn(record, compact)) return compact;
	for (const k of Object.keys(record)) {
		if (k === name || k === id || k === compact) continue;
		const nk = normalizeColumnKey(k);
		if (nk === id || compactColumnId(nk) === compact) return k;
	}
	return undefined;
}

export function getColumn<T>(
	record: Record<string, T>,
	name: string,
): T | undefined {
	const k = findColumnKey(record, name);
	return k === undefined ? undefined : record[k];
}

export function putColumn<T>(
	record: Record<string, T>,
	name: string,
	value: T,
): void {
	const key = findColumnKey(record, name) ?? name;
	record[key] = value;
}

export function columnKeysEqual(a: string, b: string): boolean {
	const na = normalizeColumnKey(a);
	const nb = normalizeColumnKey(b);
	return na === nb || compactColumnId(na) === compactColumnId(nb);
}
