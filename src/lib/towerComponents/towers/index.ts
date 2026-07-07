const wikiModules = import.meta.glob("./*.wiki", {
  eager: true,
  query: "?raw",
}) as Record<string, string>;

export const towerNames: string[] = Object.keys(wikiModules)
  .map((path) => path.slice(2, -5))
  .sort();

export const towerCategoryOrder = [
  "Starter",
  "Intermediate",
  "Advanced",
  "Hardcore",
  "Evolved",
  "Golden Perks",
  "Exclusive",
  "Unavailable",
  "Custom",
] as const;

export type TowerCategory = (typeof towerCategoryOrder)[number];

const isDebug =
  typeof localStorage !== "undefined" &&
  localStorage.getItem("tdse_debug") === "true";

const categoryByTower = new Map<string, TowerCategory>();
for (const [path, content] of Object.entries(wikiModules)) {
  const name = path.slice(2, -5);
  const cat =
    content.match(/\$FSE-CATEGORY\$\s*=\s*["']?([^"'\s;]+)["']?/i)?.[1] ?? null;
  if (cat && (towerCategoryOrder as readonly string[]).includes(cat)) {
    categoryByTower.set(name, cat as TowerCategory);
  } else if (isDebug) {
    console.debug(`[towers] FSE-CATEGORY for ${name}: ${cat ?? "none"}`);
  }
}

export function groupedTowerNames(
  names: readonly string[],
  query: string,
): { label: TowerCategory; towers: string[] }[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? names.filter((name) => name.toLowerCase().includes(q))
    : names;

  const buckets = new Map<TowerCategory, string[]>();
  for (const name of filtered) {
    const label = categoryByTower.get(name) ?? "Custom";
    const bucket = buckets.get(label) ?? [];
    bucket.push(name);
    buckets.set(label, bucket);
  }

  return towerCategoryOrder.flatMap((label) => {
    const towers = buckets.get(label);
    if (!towers?.length) return [];
    towers.sort((a, b) => a.localeCompare(b));
    return [{ label, towers }];
  });
}
