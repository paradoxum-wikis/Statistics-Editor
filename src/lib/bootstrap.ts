import { profileStore } from "$lib/stores/profile.svelte";
import { settingsStore } from "$lib/stores/settings.svelte";
import { towerStore } from "$lib/stores/tower.svelte";

let ready: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  ready ??= (async () => {
    profileStore.init();
    settingsStore.init();
    await towerStore.init(profileStore.current);
  })();
  return ready;
}
