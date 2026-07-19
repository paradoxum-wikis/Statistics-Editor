<script lang="ts">
  import { tick } from "svelte";
  import { FileBraces, Table } from "@lucide/svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { analytics } from "$lib/services/analytics";

  let {
    mode = $bindable<"cells" | "wiki">("cells"),
    disableCells = false,
    class: className = "",
  }: {
    mode?: "cells" | "wiki";
    disableCells?: boolean;
    class?: string;
  } = $props();

  async function switchToCells() {
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
    mode = "wiki";
    analytics.track("editor_mode", { mode: "wiki" });
  }
</script>

<div class="mode-toggle-group {className}">
  <button
    class="mode-toggle-btn {mode === 'cells' && !disableCells
      ? 'active'
      : 'inactive'} {disableCells ? 'opacity-50 cursor-not-allowed' : ''}"
    onclick={() => void switchToCells()}
    disabled={disableCells}
  >
    <div class="flex items-center gap-1.5">
      <Table size={16} />
      <span>Visual</span>
    </div>
  </button>
  <button
    class="mode-toggle-btn {mode === 'wiki' || disableCells
      ? 'active'
      : 'inactive'}"
    onclick={switchToWiki}
  >
    <div class="flex items-center gap-1.5">
      <FileBraces size={16} />
      <span>Source</span>
    </div>
  </button>
</div>

<style>
  .mode-toggle-group {
    display: flex;
    border-radius: var(--radius) 0;
    background: var(--muted);
    padding: 0.25rem;
    border: 1px solid var(--border);
  }

  .mode-toggle-btn {
    border-radius: calc(var(--radius) - 0.25rem) 0;

    div {
      padding: 0.25rem 1rem;
      font-size: 0.875rem;
      transition: color 0.15s;
    }

    &.active {
      background: var(--background);
      color: var(--foreground);
      box-shadow: 0 1px 2px oklch(0 0 0 / 0.05);
    }

    &.inactive {
      color: var(--muted-foreground);

      &:hover {
        color: var(--foreground);
      }
    }
  }
</style>
