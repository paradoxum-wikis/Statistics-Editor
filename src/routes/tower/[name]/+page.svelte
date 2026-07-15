<script lang="ts">
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { bootstrap } from "$lib/bootstrap";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { parseShareRef } from "$lib/services/shareTower";
  import { analytics } from "$lib/services/analytics";

  async function syncTowerFromRoute() {
    await bootstrap();
    const name = page.params.name;
    if (!name) return;

    const shareParam = page.url.searchParams.get("share");
    const shareId = shareParam ? parseShareRef(shareParam) : null;
    const sameTower =
      towerStore.selectedName.toLowerCase() === name.trim().toLowerCase();

    if (shareId) {
      if (towerStore.sharePreviewId === shareId && sameTower) {
        return;
      }
      try {
        const ok = await towerStore.importFromShare(shareId);
        if (!ok) {
          analytics.track("share_import", {
            tower_name: shareId,
            success: false,
          });
          alert("Failed to import shared tower.");
          await goto(resolve("/"), {
            replaceState: true,
            keepFocus: true,
            noScroll: true,
          });
          return;
        }
        const imported = towerStore.selectedName;
        if (imported.toLowerCase() !== name.trim().toLowerCase()) {
          const path = resolve("/tower/[name]", { name: imported });
          await goto(
            resolve(
              `${path}?share=${encodeURIComponent(shareId)}` as `/tower/${string}`,
            ),
            { replaceState: true, keepFocus: true, noScroll: true },
          );
        }
        return;
      } catch (e) {
        analytics.track("share_import", {
          tower_name: shareId,
          success: false,
        });
        alert(
          e instanceof Error ? e.message : "Failed to import shared tower.",
        );
        await goto(resolve("/"), {
          replaceState: true,
          keepFocus: true,
          noScroll: true,
        });
        return;
      }
    }

    // load() clears sharePreviewId, hence, keep an active share snapshot
    if (towerStore.sharePreviewId && sameTower) return;
    await towerStore.load(name);
  }

  afterNavigate(() => {
    void syncTowerFromRoute();
  });
</script>
