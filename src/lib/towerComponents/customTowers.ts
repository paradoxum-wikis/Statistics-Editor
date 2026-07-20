import { settingsStore } from "$lib/stores/settings.svelte";

const CUSTOM_TOWERS_KEY = "tdse_custom_towers";

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function getCustomTowers(): string[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(CUSTOM_TOWERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === "string" && !!n.trim())
      : [];
  } catch (e) {
    if (settingsStore.debugMode) console.error("[customTowers] read", e);
    return [];
  }
}

export function isCustomTower(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return getCustomTowers().some((n) => n.toLowerCase() === lower);
}

export function addCustomTower(
  name: string,
  existingNames: readonly string[],
): boolean {
  const trimmed = name.trim();
  if (!trimmed || !canUseLocalStorage()) return false;

  const lower = trimmed.toLowerCase();
  if (
    existingNames.some((n) => n.toLowerCase() === lower) ||
    getCustomTowers().some((n) => n.toLowerCase() === lower)
  ) {
    return false;
  }

  const next = [...getCustomTowers(), trimmed].sort();
  localStorage.setItem(CUSTOM_TOWERS_KEY, JSON.stringify(next));
  return true;
}

export function removeCustomTower(name: string): void {
  if (!canUseLocalStorage() || !isCustomTower(name)) return;
  const lower = name.trim().toLowerCase();
  const next = getCustomTowers().filter((n) => n.toLowerCase() !== lower);
  localStorage.setItem(CUSTOM_TOWERS_KEY, JSON.stringify(next));
}

/**
 * Loading custom tower towers received via share that didn't exist locally.
 */
export function guaraCustomTower(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || !canUseLocalStorage()) return;

  const lower = trimmed.toLowerCase();
  const customs = getCustomTowers();
  if (!customs.some((n) => n.toLowerCase() === lower)) {
    const next = [...customs, trimmed].sort();
    localStorage.setItem(CUSTOM_TOWERS_KEY, JSON.stringify(next));
  }
}
