import { authStore } from "$lib/stores/auth.svelte";
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
  })();
  return ready;
}
