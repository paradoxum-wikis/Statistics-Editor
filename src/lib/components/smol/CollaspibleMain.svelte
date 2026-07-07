<script lang="ts">
  import { Accordion } from "bits-ui";
  import { ChevronDown } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import type { Snippet } from "svelte";

  let {
    title,
    itemValue,
    value = $bindable(""),
    class: className = "",
    children,
  }: {
    title: string;
    itemValue: string;
    value?: string;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<Accordion.Root type="single" bind:value class={["mt-4", className]}>
  <Accordion.Item value={itemValue}>
    <Accordion.Header class="m-0">
      <Accordion.Trigger
        class="group flex w-full items-center justify-between gap-3 border-b border-border py-2"
      >
        <span class="font-semibold leading-1">{title}</span>
        <ChevronDown
          class="size-4 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
        />
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content forceMount>
      {#snippet child({ open })}
        {#if open}
          <div transition:slide={{ duration: 150 }}>
            {@render children()}
          </div>
        {/if}
      {/snippet}
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
