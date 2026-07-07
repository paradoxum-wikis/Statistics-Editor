<script lang="ts">
  import { Popover } from "bits-ui";
  import { Zap } from "@lucide/svelte";
  import IconBtn from "../smol/IconBtn.svelte";
  import GlobalModifierPanel from "./GlobalModifierPanel.svelte";
  import { modifierStore } from "$lib/stores/modifier.svelte";
  import { isGlobalModifierActive } from "$lib/utils/globalModifier";

  let {
    variant = "icon",
    open = $bindable(false),
    onOpen,
  }: {
    variant?: "icon" | "menu";
    open?: boolean;
    onOpen?: () => void;
  } = $props();

  const active = $derived(
    isGlobalModifierActive({ entries: modifierStore.entries }),
  );
</script>

{#if variant === "menu"}
  <button
    class="dropdown-item w-full justify-start! {active
      ? 'text-amber-600 dark:text-amber-400'
      : ''}"
    onclick={() => onOpen?.()}
  >
    <Zap class="me-2 h-4 w-4" />
    <span>Global Modifier</span>
  </button>
{:else}
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <IconBtn
          {...props}
          class="status-bar-btn {active
            ? 'text-amber-600 dark:text-amber-400'
            : ''}"
          title="Global Modifier"
        >
          <Zap size={16} />
        </IconBtn>
      {/snippet}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        class="popover-content w-[min(36rem,calc(100vw-2rem))]!"
        side="top"
        align="start"
        sideOffset={6}
      >
        <GlobalModifierPanel />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
{/if}
