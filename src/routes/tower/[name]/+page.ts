import { towerNames } from "$lib/towerComponents/towers";

export const prerender = true;

export function entries() {
  return towerNames.map((name) => ({ name }));
}
