const TOWER_CATEGORY_RE = /\$FSE-CATEGORY\$\s*=\s*["']?([^\n;"']+)/i;

export function parseTowerCategory(wikitext: string): string | null {
  return wikitext.match(TOWER_CATEGORY_RE)?.[1]?.trim() || null;
}
