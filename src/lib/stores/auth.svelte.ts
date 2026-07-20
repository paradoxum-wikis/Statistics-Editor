import {
  completeFandomAuth,
  fetchFandomProfile,
  fetchMe,
  logoutAuth,
  rememberFandomAvatar,
  startFandomAuth,
  type AuthUser,
  type FandomStart,
} from "$lib/services/fandomAuth";
import { settingsStore } from "$lib/stores/settings.svelte";

class AuthStore {
  user = $state.raw<AuthUser | null>(null);
  ready = $state(false);
  busy = $state(false);
  error = $state<string | null>(null);
  challenge = $state.raw<FandomStart | null>(null);

  async init() {
    try {
      this.user = await withProfile(await fetchMe());
    } catch (e) {
      if (settingsStore.debugMode) console.error("[auth] init", e);
      this.user = null;
    } finally {
      this.ready = true;
    }
  }

  async start(username: string) {
    this.busy = true;
    this.error = null;
    this.challenge = null;
    try {
      this.challenge = await startFandomAuth(username);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      if (settingsStore.debugMode) console.error("[auth] start", e);
    } finally {
      this.busy = false;
    }
  }

  async complete() {
    if (!this.challenge) {
      this.error = "No active challenge";
      return;
    }
    this.busy = true;
    this.error = null;
    try {
      this.user = await withProfile(
        await completeFandomAuth(this.challenge.challenge_id),
      );
      this.challenge = null;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      if (settingsStore.debugMode) console.error("[auth] complete", e);
    } finally {
      this.busy = false;
    }
  }

  async logout() {
    this.busy = true;
    this.error = null;
    try {
      await logoutAuth();
      this.user = null;
      this.challenge = null;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      if (settingsStore.debugMode) console.error("[auth] logout", e);
    } finally {
      this.busy = false;
    }
  }

  clearChallenge() {
    this.challenge = null;
    this.error = null;
  }
}

async function withProfile(user: AuthUser | null): Promise<AuthUser | null> {
  if (!user) return null;
  try {
    const profile = await fetchFandomProfile(user.fandom_userid);
    const merged = { ...user, ...profile };
    rememberFandomAvatar(user.fandom_userid, merged.avatar ?? null);
    return merged;
  } catch (e) {
    if (settingsStore.debugMode) console.error("[auth] profile", e);
    return user;
  }
}

export const authStore = new AuthStore();
