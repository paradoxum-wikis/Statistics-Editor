<script lang="ts">
  import { Popover } from "bits-ui";
  import { ChartNoAxesCombined } from "@lucide/svelte";
  import IconBtn from "../smol/IconBtn.svelte";
  import StatsChartPanel from "./StatsChartPanel.svelte";
  import { analytics } from "$lib/services/analytics";
  import { towerStore } from "$lib/stores/tower.svelte";

  let {
    variant = "icon",
    open = $bindable(false),
    onOpen,
  }: {
    variant?: "icon" | "menu";
    open?: boolean;
    onOpen?: () => void;
  } = $props();

  const hasTower = $derived(!!towerStore.selectedData);
</script>

{#if variant === "menu"}
  <button
    class="dropdown-item w-full justify-start! {hasTower ? '' : 'opacity-60'}"
    onclick={() => {
      analytics.track("stats_comparator", { action: "open", source: "mobile" });
      onOpen?.();
    }}
  >
    <ChartNoAxesCombined class="me-2 h-4 w-4" />
    <span>Statistics Comparator</span>
  </button>
{:else}
  <Popover.Root
    bind:open
    onOpenChange={(next) => {
      if (next)
        analytics.track("stats_comparator", {
          action: "open",
          source: "desktop",
        });
    }}
  >
    <Popover.Trigger>
      {#snippet child({ props })}
        <IconBtn
          {...props}
          class="status-bar-btn"
          title="Statistics Comparator"
        >
          <ChartNoAxesCombined size={16} />
        </IconBtn>
      {/snippet}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        class="popover-content max-h-[min(80dvh,42rem)] w-[min(42rem,calc(100vw-2rem))]! overflow-y-auto"
        side="top"
        align="start"
        sideOffset={6}
      >
        <StatsChartPanel />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
{/if}
