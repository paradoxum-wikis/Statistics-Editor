<script lang="ts">
  import { Collapsible as Col } from "bits-ui";
  import { ChevronDown } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import Separator from "./Separator.svelte";
  import type { Snippet } from "svelte";
  import type { Icon } from "@lucide/svelte";

  let {
    title,
    icon: IconComponent,
    open = $bindable(false),
    isPvp = false,
    children,
  }: {
    title: string;
    icon?: typeof Icon;
    open?: boolean;
    isPvp?: boolean;
    children: Snippet;
  } = $props();
</script>

<Col.Root bind:open>
  <Col.Trigger
    class="group flex w-full cursor-pointer items-center justify-between gap-2 border border-border bg-surface rounded-md px-2.5 py-2 transition-colors hover:bg-surface-2 my-1"
  >
    <span
      class="section-title flex items-center gap-1.5 text-sm font-semibold text-foreground"
    >
      {#if IconComponent}
        <IconComponent class="inline w-3.5 h-3.5 opacity-70" />
      {/if}
      {title}
      {#if isPvp}
        <span class="text-xs font-normal text-muted-foreground">(PVP)</span>
      {/if}
    </span>
    <span
      class="flex size-5 items-center justify-center rounded-sm bg-surface-2 text-muted-foreground transition-transform duration-150 ease-in-out group-data-[state=open]:rotate-180 group-data-[state=open]:text-foreground"
    >
      <ChevronDown class="h-3.5 w-3.5" />
    </span>
  </Col.Trigger>
  <Col.Content forceMount>
    {#snippet child({ open: isOpen })}
      {#if isOpen}
        <div class="pb-2" transition:slide={{ duration: 150 }}>
          {@render children()}
        </div>
      {/if}
    {/snippet}
  </Col.Content>
</Col.Root>
