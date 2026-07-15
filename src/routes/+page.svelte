<script lang="ts">
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { bootstrap } from "$lib/bootstrap";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { parseShareRef } from "$lib/services/shareTower";
  import { analytics } from "$lib/services/analytics";

  let handling = false;

  async function syncHomeRoute() {
    if (handling) return;
    handling = true;
    try {
      await bootstrap();

      const shareParam = page.url.searchParams.get("share");
      const shareId = shareParam ? parseShareRef(shareParam) : null;
      if (shareId) {
        try {
          const ok = await towerStore.importFromShare(shareId);
          if (ok) {
            await goto(
              resolve("/tower/[name]", { name: towerStore.selectedName }),
              { replaceState: true, keepFocus: true, noScroll: true },
            );
            return;
          }
          analytics.track("share_import", {
            tower_name: shareId,
            success: false,
          });
          alert("Failed to import shared tower.");
        } catch (e) {
          analytics.track("share_import", {
            tower_name: shareId,
            success: false,
          });
          alert(
            e instanceof Error ? e.message : "Failed to import shared tower.",
          );
        }
        await goto(resolve("/"), {
          replaceState: true,
          keepFocus: true,
          noScroll: true,
        });
        return;
      }

      // legacy ?tower=
      const towerParam = page.url.searchParams.get("tower");
      if (towerParam) {
        await goto(resolve("/tower/[name]", { name: towerParam }), {
          replaceState: true,
          keepFocus: true,
          noScroll: true,
        });
        return;
      }

      if (towerStore.selectedName) towerStore.unload();
    } finally {
      handling = false;
    }
  }

  afterNavigate(() => {
    void syncHomeRoute();
  });
</script>
