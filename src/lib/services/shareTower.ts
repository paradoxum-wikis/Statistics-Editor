import { settingsStore } from "$lib/stores/settings.svelte";
import { authStore } from "$lib/stores/auth.svelte";

const SHARE_ORIGIN = "https://tds.wiki";
const SHARE_CACHE_KEY = "tdse_share_cache";
const OWNED_SHARE_KEY = "tdse_owned_shares";
const SHARE_CACHE_MAX = 32;

export type ShareOwner = {
  fandom_userid: number;
  fandom_username: string;
};

export type ShareRecord = {
  id: string;
  neowtext: string;
  tower_name?: string;
  views?: number;
  created_at?: string;
  owner?: ShareOwner;
};

const memoryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function sharePageUrl(id: string): string {
  return `${SHARE_ORIGIN}/s/${id}`;
}

export function parseShareRef(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromPath = trimmed.match(/\/s\/([A-Za-z0-9]{1,12})(?:[/?#]|$)/);
  if (fromPath) return fromPath[1];
  if (/^[A-Za-z0-9]{1,12}$/.test(trimmed)) return trimmed;
  return null;
}

async function shareContentHash(
  neowtext: string,
  towerName?: string,
): Promise<string> {
  const payload = `${towerName?.trim() ?? ""}\n${neowtext}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readSessionMap(key: string): Record<string, string> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch (e) {
    if (settingsStore.debugMode) console.error("[shareTower] session map", e);
    return {};
  }
}

function getCachedShareId(hash: string): string | null {
  const fromMemory = memoryCache.get(hash);
  if (fromMemory) return fromMemory;
  const fromSession = readSessionMap(SHARE_CACHE_KEY)[hash];
  if (fromSession) {
    memoryCache.set(hash, fromSession);
    return fromSession;
  }
  return null;
}

function setCachedShareId(hash: string, id: string): void {
  memoryCache.set(hash, id);
  if (typeof sessionStorage === "undefined") return;
  try {
    const stored = readSessionMap(SHARE_CACHE_KEY);
    stored[hash] = id;
    const keys = Object.keys(stored);
    while (keys.length > SHARE_CACHE_MAX) {
      const drop = keys.shift();
      if (drop) delete stored[drop];
    }
    sessionStorage.setItem(SHARE_CACHE_KEY, JSON.stringify(stored));
  } catch (e) {
    if (settingsStore.debugMode) console.error("[shareTower] cache write", e);
  }
}

function ownedShareId(towerName: string): string | null {
  const key = towerName.trim().toLowerCase();
  return key ? (readSessionMap(OWNED_SHARE_KEY)[key] ?? null) : null;
}

function rememberOwnedShare(towerName: string, id: string): void {
  const key = towerName.trim().toLowerCase();
  if (!key || typeof sessionStorage === "undefined") return;
  try {
    const map = readSessionMap(OWNED_SHARE_KEY);
    map[key] = id;
    sessionStorage.setItem(OWNED_SHARE_KEY, JSON.stringify(map));
  } catch (e) {
    if (settingsStore.debugMode) console.error("[shareTower] owned map write", e);
  }
}

export async function createShare(
  neowtext: string,
  towerName?: string,
  own = false,
): Promise<string> {
  own = own && !!authStore.user;
  const hash = await shareContentHash(neowtext, towerName);
  const cached = getCachedShareId(hash);
  if (cached) return cached;

  const pending = inflight.get(hash);
  if (pending) return pending;

  const replaceId = own && towerName ? ownedShareId(towerName) : null;

  const promise = (async (): Promise<string> => {
    const res = await fetch(`${SHARE_ORIGIN}/aapi/shares`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        neowtext,
        tower_name: towerName?.trim() || undefined,
        own,
        ...(replaceId ? { replace_id: replaceId } : {}),
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).trim();
      throw new Error(detail || `Share failed (${res.status})`);
    }
    const data = (await res.json()) as { id?: string; owned?: boolean };
    if (!data.id) throw new Error("Share failed: no id returned");
    setCachedShareId(hash, data.id);
    if (towerName && data.owned) rememberOwnedShare(towerName, data.id);
    return data.id;
  })().finally(() => {
    inflight.delete(hash);
  });

  inflight.set(hash, promise);
  return promise;
}

export async function fetchShare(id: string): Promise<ShareRecord> {
  const shareId = parseShareRef(id);
  if (!shareId) throw new Error("Invalid share id");

  const res = await fetch(`${SHARE_ORIGIN}/aapi/shares/${shareId}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const detail = (await res.text()).trim();
    throw new Error(detail || `Share not found (${res.status})`);
  }
  return (await res.json()) as ShareRecord;
}
