import type Tower from "$lib/towerComponents/tower";
import type SkinData from "$lib/towerComponents/skinData";
import { mkCellKey } from "$lib/neowtext/directives";
import { toDisplayNumber } from "$lib/utils/format";

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

export function collectCompareValues(tower: Tower): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const skinName of tower.skinNames) {
    const skin = tower.getSkin(skinName);
    if (!skin) continue;
    const headers =
      skin.headers.length > 0 ? skin.headers : skin.levels.attributes;
    for (let i = 0; i < skin.levels.levels.length; i++) {
      for (const header of headers) {
        out[mkCellKey(skinName, 0, i, header)] =
          header === "Level" ? i : skin.levels.getCell(i, header);
      }
    }
    skin.extraTables?.forEach((ext, idx) => {
      const tableIdx = idx + 1;
      for (let i = 0; i < ext.rows.length; i++) {
        for (const header of ext.headers) {
          out[mkCellKey(skinName, tableIdx, i, header)] =
            header === "Level" ? i : ext.rows[i]?.[header];
        }
      }
    });
  }
  return out;
}

export function mergeBaselineOnTowerDiff(
  oldTower: Tower,
  newTower: Tower,
  baseline: Record<string, unknown>,
): Record<string, unknown> {
  const oldVals = collectCompareValues(oldTower);
  const newVals = collectCompareValues(newTower);
  const next = { ...baseline };
  for (const [key, newVal] of Object.entries(newVals)) {
    if (key in next) continue;
    const oldVal = oldVals[key];
    if (oldVal === undefined) continue;
    const oldN = toDisplayNumber(oldVal, false);
    const newN = toDisplayNumber(newVal, false);
    if (oldN == null || newN == null) continue;
    if (Math.abs(newN - oldN) >= 1e-9) next[key] = oldVal;
  }
  return next;
}
