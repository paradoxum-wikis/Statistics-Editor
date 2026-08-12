const META_RE = /\$FSE-META\$\s*=\s*(.+)/i;
const CATEGORY_RE = /\$FSE-CATEGORY\$\s*=\s*["']?([^\n;"']+)/i;

export type TowerMeta = { category: string; image?: string };

export function parseTowerMeta(wikitext: string): TowerMeta | null {
  const raw = wikitext.match(META_RE)?.[1]?.trim();
  if (raw) {
    const [category, image] = raw.split(";").map((s) => s.trim());
    if (category) return { category, image: image || undefined };
  }
  const category = wikitext.match(CATEGORY_RE)?.[1]?.trim();
  return category ? { category } : null;
}
