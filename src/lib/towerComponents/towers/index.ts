import { listWikiOverrides } from "$lib/neowtext/wikiSource";
import { parseTowerCategory } from "$lib/plugins/towers/parse";
import { categoryEntries, towerNames } from "virtual:towers";

// $FSE-CATEGORY$
export { towerNames };
export const towerCategoryOrder = [
  "Starter",
  "Intermediate",
  "Advanced",
  "Hardcore",
  "Evolved",
  "Golden Perks",
  "Exclusive",
  "Unavailable",
] as const;

const baseCategoryMap = new Map<string, string>(categoryEntries);

function categoryFromWikitext(wikitext: string): string {
  return parseTowerCategory(wikitext) ?? "Custom";
}

export function buildCategoryMap(
  profileName: string,
  live?: { towerName: string; wikitext: string },
): Map<string, string> {
  const map = new Map(baseCategoryMap);

  for (const [tower, wikitext] of listWikiOverrides(profileName)) {
    map.set(tower, categoryFromWikitext(wikitext));
  }

  if (live?.towerName && live.wikitext.trim()) {
    map.set(live.towerName, categoryFromWikitext(live.wikitext));
  }

  return map;
}

export function groupedTowerNames(
  names: readonly string[],
  query: string,
  categoryByTower: ReadonlyMap<string, string>,
): { label: string; towers: string[] }[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? names.filter((name) => name.toLowerCase().includes(q))
    : names;

  const buckets = new Map<string, string[]>();
  for (const name of filtered) {
    const label = categoryByTower.get(name) ?? "Custom";
    const bucket = buckets.get(label) ?? [];
    bucket.push(name);
    buckets.set(label, bucket);
  }

  const known = new Set<string>(towerCategoryOrder);
  const dynamicLabels = [...buckets.keys()]
    .filter((label) => !known.has(label) && label !== "Custom")
    .sort((a, b) => a.localeCompare(b));

  const orderedLabels = [
    ...towerCategoryOrder.filter((label) => buckets.has(label)),
    ...dynamicLabels,
    ...(buckets.has("Custom") ? ["Custom"] : []),
  ];

  return orderedLabels.map((label) => {
    const towers = buckets.get(label)!;
    towers.sort((a, b) => a.localeCompare(b));
    return { label, towers };
  });
}
