import { categoryEntries } from "virtual:categories";

const wikiModules = import.meta.glob("./*.wiki", {
  eager: true,
  query: "?raw",
  import: "default",
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

function isTowerCategory(value: string): value is TowerCategory {
  return (towerCategoryOrder as readonly string[]).includes(value);
}

const categoryByTower = new Map<string, TowerCategory>(
  categoryEntries.map(([tower, category]): [string, TowerCategory] => [
    tower,
    isTowerCategory(category) ? category : "Custom",
  ]),
);

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
