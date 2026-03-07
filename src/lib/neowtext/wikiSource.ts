import { settingsStore } from "$lib/stores/settings.svelte";

const WIKI_OVERRIDE_PREFIX = "tds_wiki_override::";

function overrideKey(profileName: string, towerName: string): string {
  return `${WIKI_OVERRIDE_PREFIX}${profileName}::${towerName}`;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function getWikiOverride(
  profileName: string,
  towerName: string,
): string | null {
  if (!canUseLocalStorage()) return null;

  const key = overrideKey(profileName, towerName);
  const value = localStorage.getItem(key);
  if (settingsStore.debugMode) {
    console.log(
      `[wikiSource] getWikiOverride key="${key}" found=${!!value} length=${value?.length}`,
    );
  }
  return value && value.trim() ? value : null;
}

export function setWikiOverride(
  profileName: string,
  towerName: string,
  wikitext: string | null,
): void {
  if (!canUseLocalStorage()) return;

  const key = overrideKey(profileName, towerName);
  const content = (wikitext ?? "").trim();

  if (settingsStore.debugMode) {
    console.log(
      `[wikiSource] setWikiOverride key="${key}" content_length=${content.length}`,
    );
  }

  if (!content) {
    if (settingsStore.debugMode) {
      console.log(`[wikiSource] Clearing override for ${key}`);
    }
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, content);
}

export function hasWikiOverride(
  profileName: string,
  towerName: string,
): boolean {
  return getWikiOverride(profileName, towerName) != null;
}

export function clearWikiOverride(
  profileName: string,
  towerName: string,
): void {
  setWikiOverride(profileName, towerName, null);
}

export async function loadEffectiveWikitext(
  profileName: string,
  towerName: string,
  loadBase: () => Promise<string>,
): Promise<{ source: "override" | "base"; text: string }> {
  const override = getWikiOverride(profileName, towerName);
  if (override != null) {
    if (settingsStore.debugMode) {
      console.log(
        `[wikiSource] loadEffectiveWikitext: returning override for ${towerName}`,
      );
    }
    return { source: "override", text: override };
  }

  if (settingsStore.debugMode) {
    console.log(
      `[wikiSource] loadEffectiveWikitext: loading base for ${towerName}`,
    );
  }
  const base = await loadBase();
  return { source: "base", text: base };
}
