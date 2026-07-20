import { proxyImageUrl } from "$lib/services/imageLoader";
import { settingsStore } from "$lib/stores/settings.svelte";

export type AuthUser = {
  id: number;
  fandom_userid: number;
  fandom_username: string;
  avatar?: string;
  edits?: number;
  posts?: number;
  linked_at?: string;
};

export type FandomStart = {
  challenge_id: string;
  expires_at: string;
  edit_url: string;
  fandom_username: string;
  page_title: string;
  summary: string;
};

export type FandomProfile = {
  avatar?: string;
  edits?: number;
  posts?: number;
};

async function parseError(res: Response): Promise<string> {
  const text = (await res.text()).trim();
  if (!text) return `Request failed (${res.status})`;
  if (text.startsWith("{")) {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) return j.error;
  }
  return text;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://tds.wiki${path}`, {
    credentials: "include",
    ...init,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}

export async function fetchFandomProfile(
  userId: number,
): Promise<FandomProfile> {
  const profileUrl = `https://tds.fandom.com/wikia.php?controller=UserProfile&method=getUserData&format=json&userId=${userId}`;
  const res = await fetch(proxyImageUrl(profileUrl));
  if (!res.ok) throw new Error(`profile fetch failed (${res.status})`);
  const { userData: u } = (await res.json()) as {
    userData?: {
      avatar?: string;
      localEdits?: number;
      posts?: number;
    };
  };
  if (!u) throw new Error("profile missing userData");
  const avatar = u.avatar?.trim() || undefined;
  if (avatar) rememberFandomAvatar(userId, avatar);
  return {
    avatar,
    edits: u.localEdits,
    posts: u.posts,
  };
}

const avatarByUser = new Map<number, string | null>();
const pendingIds = new Set<number>();
let flushPromise: Promise<void> | null = null;

function avatarDisplayUrl(raw: string | null | undefined): string | null {
  const u = raw?.trim();
  if (!u) return null;
  if (u.includes("/thumbnail/")) return u;
  return `${u.replace(/\/$/, "")}/thumbnail/width/50/height/50`;
}

export function rememberFandomAvatar(userId: number, url: string | null) {
  avatarByUser.set(userId, avatarDisplayUrl(url));
}

async function fetchAvatarBulk(ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const qs = chunk.map((id) => `id=${id}`).join("&");
      const res = await fetch(
        proxyImageUrl(
          `https://services.fandom.com/user-attribute/user/bulk?${qs}`,
        ),
      );
      if (!res.ok) throw new Error(`avatar bulk failed (${res.status})`);
      const data = (await res.json()) as {
        users?: Record<string, { avatar?: string }>;
      };
      for (const id of chunk) {
        avatarByUser.set(
          id,
          avatarDisplayUrl(data.users?.[String(id)]?.avatar),
        );
      }
    } catch (e) {
      if (settingsStore.debugMode) console.error("[fandom] avatar bulk", e);
      for (const id of chunk) {
        if (!avatarByUser.has(id)) avatarByUser.set(id, null);
      }
    }
  }
}

function enqueueAvatarFetch(ids: number[]): Promise<void> {
  for (const id of ids) {
    if (!avatarByUser.has(id)) pendingIds.add(id);
  }
  if (pendingIds.size === 0 && !flushPromise) return Promise.resolve();
  if (!flushPromise) {
    flushPromise = (async () => {
      while (pendingIds.size) {
        const batch = [...pendingIds];
        pendingIds.clear();
        const need = batch.filter((id) => !avatarByUser.has(id));
        if (need.length) await fetchAvatarBulk(need);
      }
    })().finally(() => {
      flushPromise = null;
    });
  }
  return flushPromise;
}

export async function fetchFandomAvatars(
  userIds: number[],
): Promise<Map<number, string | null>> {
  const unique = [...new Set(userIds)];
  await enqueueAvatarFetch(unique);
  const out = new Map<number, string | null>();
  for (const id of unique) out.set(id, avatarByUser.get(id) ?? null);
  return out;
}

export function fetchFandomAvatar(userId: number): Promise<string | null> {
  return fetchFandomAvatars([userId]).then((m) => m.get(userId) ?? null);
}

export async function fetchMe(): Promise<AuthUser | null> {
  const data = await api<{ user: AuthUser | null }>("/aapi/auth/me");
  return data.user ?? null;
}

export async function startFandomAuth(username: string): Promise<FandomStart> {
  return api<FandomStart>("/aapi/auth/fandom/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
}

export async function completeFandomAuth(
  challengeId: string,
): Promise<AuthUser> {
  const data = await api<{ user: AuthUser }>("/aapi/auth/fandom/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_id: challengeId }),
  });
  if (!data.user) throw new Error("No user returned");
  return data.user;
}

export async function logoutAuth(): Promise<void> {
  await api("/aapi/auth/logout", { method: "POST" });
}

export function fandomUserPage(username: string): string {
  return `https://tds.fandom.com/wiki/User:${encodeURIComponent(username.replaceAll(" ", "_"))}`;
}

export function formatProfileStats(user: AuthUser): string {
  const parts: string[] = [];
  if (user.edits != null) parts.push(`${user.edits.toLocaleString()} edits`);
  if (user.posts != null) parts.push(`${user.posts.toLocaleString()} posts`);
  return parts.join(" · ") || "Fandom account";
}
