const META_RE = /\$FSE-META\$\s*=\s*(.+)/i;
const CATEGORY_RE = /\$FSE-CATEGORY\$\s*=\s*["']?([^\n;"']+)/i;

/** @typedef {{ category: string, image?: string }} TowerMeta */

/**
 * @param {string} wikitext
 * @returns {TowerMeta | null}
 */
export function parseTowerMeta(wikitext) {
	const raw = wikitext.match(META_RE)?.[1]?.trim();
	if (raw) {
		const [category, image] = raw.split(";").map((s) => s.trim());
		if (category) return { category, image: image || undefined };
	}
	const category = wikitext.match(CATEGORY_RE)?.[1]?.trim();
	return category ? { category } : null;
}
