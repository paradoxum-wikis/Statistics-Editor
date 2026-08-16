import { listWikiOverrides } from "$lib/neowtext/wikiSource";
import { parseTowerMeta, type TowerMeta } from "$lib/plugins/towers/parse";
import { metaEntries, towerNames } from "virtual:towers";

// $FSE-META$
export { towerNames };
export type { TowerMeta };

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

const baseMetaMap = new Map<string, TowerMeta>(metaEntries);

function resolveName(map: Map<string, TowerMeta>, tower: string): string {
	if (map.has(tower)) return tower;
	const lower = tower.toLowerCase();
	for (const name of map.keys()) {
		if (name.toLowerCase() === lower) return name;
	}
	return tower;
}

export function buildMetaMap(
	profileName: string,
	live?: { towerName: string; wikitext: string },
): Map<string, TowerMeta> {
	const map = new Map(baseMetaMap);

	const apply = (tower: string, wikitext: string) => {
		const meta = parseTowerMeta(wikitext);
		if (!meta) return;
		const name = resolveName(map, tower);
		const prev = map.get(name);
		map.set(name, {
			category: meta.category,
			image: meta.image ?? prev?.image,
		});
	};

	for (const [tower, wikitext] of listWikiOverrides(profileName)) {
		apply(tower, wikitext);
	}

	if (live?.towerName && live.wikitext.trim()) {
		apply(live.towerName, live.wikitext);
	}

	return map;
}

export function groupedTowerNames(
	names: readonly string[],
	query: string,
	metaByTower: ReadonlyMap<string, TowerMeta>,
): { label: string; towers: string[] }[] {
	const q = query.trim().toLowerCase();
	const filtered = q
		? names.filter((name) => name.toLowerCase().includes(q))
		: names;

	const buckets = new Map<string, string[]>();
	for (const name of filtered) {
		const label = metaByTower.get(name)?.category ?? "Custom";
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
