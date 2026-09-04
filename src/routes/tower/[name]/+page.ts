import { error } from "@sveltejs/kit";
import { towerStore } from "$lib/stores/tower.svelte";
import { isCustomTower } from "$lib/towerComponents/customTowers";
import { towerNames } from "$lib/towerComponents/towers";
import type { EntryGenerator, PageLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
	towerNames.map((name) => ({ name }));

export const load: PageLoad = ({ params, url }) => {
	const name = params.name.trim();
	const lower = name.toLowerCase();
	if (
		towerNames.some((n) => n.toLowerCase() === lower) ||
		url.searchParams.has("share") ||
		isCustomTower(name) ||
		towerStore.selectedName.toLowerCase() === lower
	) {
		return;
	}
	error(404);
};
