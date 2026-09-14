import { api, API_ORIGIN } from "$lib/services/api";
import { settingsStore } from "$lib/stores/settings.svelte";

export const WIKI_ORIGIN = "https://tds.wiki";

export type AuthUser = {
	id: number;
	fandom_userid: number;
	fandom_username: string;
	avatar?: string;
	edits?: number;
	linked_at?: string;
};

export async function fetchMe(): Promise<AuthUser | null> {
	const data = await api<{ user: AuthUser | null }>("/aapi/auth/me");
	return data.user ?? null;
}

export function loginWithWiki(returnTo?: string): void {
	const target = returnTo?.startsWith("/") ? returnTo : "/";
	window.location.href = `${API_ORIGIN}/aapi/auth/oauth/start?return=${encodeURIComponent(target)}`;
}

export async function logoutAuth(): Promise<void> {
	await api("/aapi/auth/logout", { method: "POST" });
}

export function wikiUserPage(username: string): string {
	const name = username.replaceAll(" ", "_");
	return `${WIKI_ORIGIN}/w/User:${encodeURIComponent(name)}`;
}

export function formatProfileStats(user: AuthUser): string {
	return user.edits != null
		? `${user.edits.toLocaleString()} edits`
		: "Wiki account";
}

async function wikiQuery<T>(params: Record<string, string>): Promise<T> {
	const qs = new URLSearchParams({
		...params,
		format: "json",
		formatversion: "2",
		origin: "*",
	});
	const res = await fetch(`${WIKI_ORIGIN}/api.php?${qs}`);
	if (!res.ok) throw new Error(`wiki api failed (${res.status})`);
	return res.json() as Promise<T>;
}

function absoluteWikiUrl(raw: string | null | undefined): string | undefined {
	const s = raw?.trim();
	if (!s) return undefined;
	if (/^https?:\/\//i.test(s)) return s;
	return `${WIKI_ORIGIN}${s.startsWith("/") ? "" : "/"}${s}`;
}

const avatarByUser = new Map<number, string | null>();
const pendingUsers = new Map<number, string>();
let flushPromise: Promise<void> | null = null;

export async function fetchWikiAvatars(
	users: { id: number; name: string }[],
): Promise<Map<number, string | null>> {
	for (const { id, name } of users) {
		if (name && !avatarByUser.has(id)) pendingUsers.set(id, name);
	}
	if (pendingUsers.size && !flushPromise) {
		flushPromise = flush().finally(() => {
			flushPromise = null;
		});
	}
	await flushPromise;
	const out = new Map<number, string | null>();
	for (const { id } of users) out.set(id, avatarByUser.get(id) ?? null);
	return out;
}

export function fetchWikiAvatar(
	id: number,
	name: string,
): Promise<string | null> {
	return fetchWikiAvatars([{ id, name }]).then((m) => m.get(id) ?? null);
}

async function flush(): Promise<void> {
	while (pendingUsers.size) {
		const batch = [...pendingUsers.entries()];
		pendingUsers.clear();
		const need = batch.filter(([id]) => !avatarByUser.has(id));
		if (need.length) await fetchAvatarBulk(need);
	}
}

async function fetchAvatarBulk(entries: [number, string][]): Promise<void> {
	for (let i = 0; i < entries.length; i += 50) {
		const chunk = entries.slice(i, i + 50);
		try {
			const data = await wikiQuery<{
				query?: {
					integratedprofileavatar?: {
						user: string;
						avatar_url: string;
					}[];
				};
			}>({
				action: "query",
				list: "integratedprofileavatar",
				ipauser: chunk.map(([, name]) => name).join("|"),
			});
			const byName = new Map(
				(data.query?.integratedprofileavatar ?? []).map((r) => [
					r.user,
					r.avatar_url,
				]),
			);
			for (const [id, name] of chunk) {
				avatarByUser.set(id, absoluteWikiUrl(byName.get(name)) ?? null);
			}
		} catch (e) {
			if (settingsStore.debugMode) console.error("[wiki] avatar bulk", e);
			for (const [id] of chunk) {
				if (!avatarByUser.has(id)) avatarByUser.set(id, null);
			}
		}
	}
}

export function rememberWikiAvatar(id: number, url: string | null) {
	avatarByUser.set(id, url);
}

export async function fetchWikiProfile(
	username: string,
): Promise<{ avatar?: string; edits?: number }> {
	const data = await wikiQuery<{
		query?: {
			integratedprofile?: { avatar_url?: string; edit_count?: number };
		};
	}>({
		action: "query",
		list: "integratedprofile",
		ipuser: username,
	});
	const p = data.query?.integratedprofile;
	return { avatar: absoluteWikiUrl(p?.avatar_url), edits: p?.edit_count };
}
