import { authStore } from "$lib/stores/auth.svelte";
import { announcementsStore } from "$lib/stores/announcements.svelte";
import { inboxStore } from "$lib/stores/inbox.svelte";
import { profileStore } from "$lib/stores/profile.svelte";
import { settingsStore } from "$lib/stores/settings.svelte";
import { towerStore } from "$lib/stores/tower.svelte";

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
