import { proxyImageUrl } from "$lib/services/imageLoader";

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
  return {
    avatar: u.avatar,
    edits: u.localEdits,
    posts: u.posts,
  };
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
