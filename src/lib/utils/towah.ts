import type Tower from "$lib/towerComponents/tower";
import type SkinData from "$lib/towerComponents/skinData";

/**
 * Returns the skins that should be updated when the user edits a value.
 * - If the current skin is PVP, only that skin is targeted.
 * - Otherwise, all non PVP skins are targeted.
 */
export function getTargetSkins(
  tower: Tower,
  currentSkin: SkinData,
): SkinData[] {
  if (currentSkin.isPvp) {
    return [currentSkin];
  }
  return tower.skinNames
    .map((name) => tower.getSkin(name))
    .filter((skin): skin is SkinData => !!skin && !skin.isPvp);
}
