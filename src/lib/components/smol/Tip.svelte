<script lang="ts">
  import { Tooltip as JustTheTip } from "bits-ui";
  import type { Snippet } from "svelte";

  let {
    content,
    side = "top",
    sideOffset = 6,
    class: className = "",
    children,
  }: {
    content?: string | Snippet;
    side?: "top" | "bottom" | "left" | "right";
    sideOffset?: number;
    class?: string;
    children: Snippet<[{ props: Record<string, unknown> }]>;
  } = $props();
</script>

<JustTheTip.Root>
  <JustTheTip.Trigger>
    {#snippet child({ props })}
      {@render children({ props })}
    {/snippet}
  </JustTheTip.Trigger>
  <JustTheTip.Portal>
    <JustTheTip.Content class="tip {className}" {side} {sideOffset}>
      {#if typeof content === "string"}
        {content}
      {:else if content}
        {@render content()}
      {/if}
    </JustTheTip.Content>
  </JustTheTip.Portal>
</JustTheTip.Root>

<style>
  :global(.tip) {
    z-index: 57;
    max-width: 14rem;
    border-radius: calc(var(--radius) - 0.25rem) 0;
    border: 1px solid var(--border);
    background: var(--popover);
    color: var(--popover-foreground);
    padding: 0.375rem 0.625rem;
    font-size: 0.875rem;
    box-shadow:
      0 4px 6px -1px oklch(0 0 0 / 0.1),
      0 2px 4px -2px oklch(0 0 0 / 0.1);

    &[data-state="delayed-open"] {
      animation: overlay-in 150ms ease;
    }

    &[data-state="closed"] {
      animation: overlay-out 100ms ease;
    }
  }
</style>
