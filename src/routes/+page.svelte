<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { parseShareRef } from "$lib/services/shareTower";
  import { analytics } from "$lib/services/analytics";
  import DesktopLayout from "$lib/components/DesktopLayout.svelte";
  import MobileLayout from "$lib/components/MobileLayout.svelte";

  let isClient = $state(false);

  onMount(async () => {
    isClient = true;
    profileStore.init();
    settingsStore.init();
    await towerStore.init(profileStore.current);

    const shareParam = page.url.searchParams.get("share");
    const shareId = shareParam ? parseShareRef(shareParam) : null;
    if (shareId) {
      const url = new URL(page.url);
      url.searchParams.delete("share");
      try {
        const ok = await towerStore.importFromShare(shareId);
        if (ok) url.searchParams.set("tower", towerStore.selectedName);
        else {
          analytics.track("share_import", {
            tower_name: shareId,
            success: false,
          });
          alert("Failed to import shared tower.");
        }
      } catch (e) {
        analytics.track("share_import", {
          tower_name: shareId,
          success: false,
        });
        alert(
          e instanceof Error ? e.message : "Failed to import shared tower.",
        );
      }
      await goto(url, { replaceState: true, keepFocus: true, noScroll: true });
      return;
    }

    const towerParam = page.url.searchParams.get("tower");
    if (towerParam && towerStore.names.includes(towerParam)) {
      await towerStore.load(towerParam);
    }
  });
</script>

<svelte:window
  onbeforeunload={(e) => {
    if (!towerStore.isDirty) return;
    e.preventDefault();
  }}
/>

<div class="hidden md:flex h-screen flex-col">
  <DesktopLayout {isClient} />
</div>

<div class="md:hidden">
  <MobileLayout {isClient} />
</div>
