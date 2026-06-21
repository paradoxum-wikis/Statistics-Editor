<script lang="ts">
  import { FileBraces, Table } from "@lucide/svelte";

  let {
    mode = $bindable<"cells" | "wiki">("cells"),
    disableCells = false,
    class: className = "",
  }: {
    mode?: "cells" | "wiki";
    disableCells?: boolean;
    class?: string;
  } = $props();
</script>

<div class="mode-toggle-group {className}">
  <button
    class="mode-toggle-btn {mode === 'cells' && !disableCells
      ? 'active'
      : 'inactive'} {disableCells ? 'opacity-50 cursor-not-allowed' : ''}"
    onclick={() => (mode = "cells")}
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
    onclick={() => (mode = "wiki")}
  >
    <div class="flex items-center gap-1.5">
      <FileBraces size={16} />
      <span>Source</span>
    </div>
  </button>
</div>
