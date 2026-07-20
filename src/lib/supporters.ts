import { settingsStore } from "$lib/stores/settings.svelte";

export type Profile = {
  name: string;
  avatar: string;
  link: string;
};

export type Supporter = {
  name: string;
  avatar: string;
  link: string;
  msg: string;
  tier: string;
};

export type SupportersData = {
  profile: Profile | null;
  supporters: Supporter[];
};

let cache: SupportersData | null = null;
let loadPromise: Promise<SupportersData> | null = null;

function isSupporter(value: unknown): value is Supporter {
  if (typeof value !== "object" || value === null) return false;
  const { name, avatar, link, msg, tier } = value as Record<string, unknown>;
  return (
    typeof name === "string" &&
    typeof avatar === "string" &&
    typeof link === "string" &&
    typeof msg === "string" &&
    typeof tier === "string"
  );
}

function parseProfile(root: Record<string, unknown>): Profile | null {
  const { name, avatar, link } = root;
  if (
    typeof name !== "string" ||
    typeof avatar !== "string" ||
    typeof link !== "string"
  ) {
    return null;
  }
  return { name, avatar, link };
}

function parseSupportersData(data: unknown): SupportersData {
  if (typeof data !== "object" || data === null) {
    return { profile: null, supporters: [] };
  }

  const root = data as Record<string, unknown>;
  return {
    profile: parseProfile(root),
    supporters: Array.isArray(root.supporters)
      ? root.supporters.filter(isSupporter)
      : [],
  };
}

export function loadSupporters(): Promise<SupportersData> {
  if (cache) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch("https://bin.t7ru.link/fol/supporters.json");
      if (!res.ok) throw new Error();
      cache = parseSupportersData(await res.json());
    } catch (e) {
      if (settingsStore.debugMode) console.error("[supporters] load", e);
      cache = { profile: null, supporters: [] };
    }
    return cache;
  })();

  return loadPromise;
}
