<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import DesktopLayout from "$lib/components/DesktopLayout.svelte";
  import MobileLayout from "$lib/components/MobileLayout.svelte";

  let isClient = $state(false);

  onMount(async () => {
    isClient = true;
    profileStore.init();
    settingsStore.init();
    await towerStore.init(profileStore.current);

    const towerParam = page.url.searchParams.get("tower");
    if (towerParam && towerStore.names.includes(towerParam)) {
      await towerStore.load(towerParam);
    }
  });
</script>

<div class="hidden md:flex h-screen flex-col">
  <DesktopLayout {isClient} />
</div>

<div class="md:hidden">
  <MobileLayout {isClient} />
</div>
