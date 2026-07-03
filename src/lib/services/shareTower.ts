import { settingsStore } from "$lib/stores/settings.svelte";

const SHARE_ORIGIN = "https://tds.wiki";
const SHARE_CACHE_KEY = "tdse_share_cache";
const SHARE_CACHE_MAX = 32;

export type ShareRecord = {
  id: string;
  neowtext: string;
  tower_name?: string;
  created_at?: string;
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

function readSessionCache(): Record<string, string> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SHARE_CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function getCachedShareId(hash: string): string | null {
  const fromMemory = memoryCache.get(hash);
  if (fromMemory) return fromMemory;
  const fromSession = readSessionCache()[hash];
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
    const stored = readSessionCache();
    stored[hash] = id;
    const keys = Object.keys(stored);
    while (keys.length > SHARE_CACHE_MAX) {
      const drop = keys.shift();
      if (drop) delete stored[drop];
    }
    sessionStorage.setItem(SHARE_CACHE_KEY, JSON.stringify(stored));
  } catch {
    if (settingsStore.debugMode) {
      console.log("[shareTower] browser's storage is full or unavailable.");
    }
  }
}

export async function createShare(
  neowtext: string,
  towerName?: string,
): Promise<string> {
  const hash = await shareContentHash(neowtext, towerName);
  const cached = getCachedShareId(hash);
  if (cached) return cached;

  const pending = inflight.get(hash);
  if (pending) return pending;

  const promise = (async (): Promise<string> => {
    const res = await fetch(`${SHARE_ORIGIN}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        neowtext,
        tower_name: towerName?.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).trim();
      throw new Error(detail || `Share failed (${res.status})`);
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error("Share failed: no id returned");
    setCachedShareId(hash, data.id);
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

  const res = await fetch(`${SHARE_ORIGIN}/api/shares/${shareId}`);
  if (!res.ok) {
    const detail = (await res.text()).trim();
    throw new Error(detail || `Share not found (${res.status})`);
  }
  return (await res.json()) as ShareRecord;
}
