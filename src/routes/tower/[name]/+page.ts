import { error } from "@sveltejs/kit";
import { isCustomTower } from "$lib/towerComponents/customTowers";
import { towerNames } from "$lib/towerComponents/towers";
import type { EntryGenerator, PageLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  towerNames.map((name) => ({ name }));

export const load: PageLoad = ({ params, url }) => {
  const name = params.name.trim();
  if (
    towerNames.some((n) => n.toLowerCase() === name.toLowerCase()) ||
    url.searchParams.has("share") ||
    isCustomTower(name)
  ) {
    return;
  }
  error(404);
};
