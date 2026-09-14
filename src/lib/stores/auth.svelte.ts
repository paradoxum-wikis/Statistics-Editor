import {
	fetchMe,
	fetchWikiProfile,
	loginWithWiki,
	logoutAuth,
	rememberWikiAvatar,
	type AuthUser,
} from "$lib/services/wikiAuth";
import { settingsStore } from "$lib/stores/settings.svelte";
import { toast } from "$lib/toast";

class AuthStore {
	user = $state.raw<AuthUser | null>(null);
	ready = $state(false);
	busy = $state(false);
	error = $state<string | null>(null);

	async init() {
		this.reportAuthError();
		try {
			this.user = await withProfile(await fetchMe());
		} catch (e) {
			if (settingsStore.debugMode) console.error("[auth] init", e);
			this.user = null;
		} finally {
			this.ready = true;
		}
	}

	login() {
		this.error = null;
		loginWithWiki(window.location.pathname + window.location.search);
	}

	async logout() {
		this.busy = true;
		this.error = null;
		try {
			await logoutAuth();
			this.user = null;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			if (settingsStore.debugMode) console.error("[auth] logout", e);
		} finally {
			this.busy = false;
		}
	}

	private reportAuthError() {
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		const authError = url.searchParams.get("auth_error");
		if (!authError) return;
		url.searchParams.delete("auth_error");
		window.history.replaceState({}, "", url.pathname + url.search + url.hash);
		toast.error(`Sign-in failed: ${authError}`);
	}
}

async function withProfile(user: AuthUser | null): Promise<AuthUser | null> {
	if (!user) return null;
	try {
		const profile = await fetchWikiProfile(user.fandom_username);
		const merged = { ...user, ...profile };
		rememberWikiAvatar(user.fandom_userid, merged.avatar ?? null);
		return merged;
	} catch (e) {
		if (settingsStore.debugMode) console.error("[auth] profile", e);
		return user;
	}
}

export const authStore = new AuthStore();
