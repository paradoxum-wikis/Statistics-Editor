<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { bootstrap } from "$lib/bootstrap";
  import { towerStore } from "$lib/stores/tower.svelte";

  async function syncTowerFromRoute() {
    await bootstrap();
    const name = page.params.name;
    if (!name) return;
    // load() clears sharePreviewId, hence, keep an active share snapshot
    if (towerStore.sharePreviewId && towerStore.selectedName === name) return;
    await towerStore.load(name);
  }

  afterNavigate(() => {
    void syncTowerFromRoute();
  });
</script>
