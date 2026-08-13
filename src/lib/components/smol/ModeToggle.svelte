<script lang="ts">
  import { tick } from "svelte";
  import { FileBraces, Table } from "@lucide/svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { analytics } from "$lib/services/analytics";
  import { tabPill } from "$lib/utils/tabPill.svelte";

  let {
    mode = $bindable<"cells" | "wiki">("cells"),
    disableCells = false,
    onModeChange,
    class: className = "",
  }: {
    mode?: "cells" | "wiki";
    disableCells?: boolean;
    onModeChange?: (mode: "cells" | "wiki") => void;
    class?: string;
  } = $props();

  async function switchToCells() {
    onModeChange?.("cells");
    mode = "cells";
    analytics.track("editor_mode", { mode: "cells" });
    await tick();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await towerStore.applyWikiWikitext();
  }

  function switchToWiki() {
    towerStore.guaraWikitextSynced();
    onModeChange?.("wiki");
    mode = "wiki";
    analytics.track("editor_mode", { mode: "wiki" });
  }
</script>

<div class="tabs-list {className}" use:tabPill={() => ({ mode, disableCells })}>
  <button
    class="tabs-trigger {mode === 'cells' && !disableCells ? 'active' : ''}"
    onclick={() => void switchToCells()}
    disabled={disableCells}
  >
    <Table size={16} />
    <span>Visual</span>
  </button>
  <button
    class="tabs-trigger {mode === 'wiki' || disableCells ? 'active' : ''}"
    onclick={switchToWiki}
  >
    <FileBraces size={16} />
    <span>Source</span>
  </button>
</div>
