import { authStore } from "#lib/stores/auth.svelte.js";
import { announcementsStore } from "#lib/stores/announcements.svelte.js";
import { inboxStore } from "#lib/stores/inbox.svelte.js";
import { profileStore } from "#lib/stores/profile.svelte.js";
import { settingsStore } from "#lib/stores/settings.svelte.js";
import { towerStore } from "#lib/stores/tower.svelte.js";

let ready: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
	ready ??= (async () => {
		profileStore.init();
		settingsStore.init();
		await Promise.all([
			towerStore.init(profileStore.current),
			authStore.init(),
		]);
		void announcementsStore.init().catch(() => {});
		if (authStore.user) void inboxStore.refresh();
	})();
	return ready;
}
