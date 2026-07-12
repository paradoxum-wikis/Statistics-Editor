<script lang="ts">
  import { Tooltip as JustTheTip } from "bits-ui";
  import type { Snippet } from "svelte";

  let {
    content,
    side = "top",
    sideOffset = 6,
    children,
  }: {
    content: string;
    side?: "top" | "bottom" | "left" | "right";
    sideOffset?: number;
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
    <JustTheTip.Content class="tooltip-content text-sm" {side} {sideOffset}>
      {content}
    </JustTheTip.Content>
  </JustTheTip.Portal>
</JustTheTip.Root>
