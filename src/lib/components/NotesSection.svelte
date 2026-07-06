<script lang="ts">
  import { Accordion } from "bits-ui";
  import { ChevronDown } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import { renderCellHtml } from "$lib/neowtext/render";
  import RenderedHtml from "./table/RenderedHtml.svelte";
  import type { SkinNote } from "$lib/towerTable";

  let { notes }: { notes: SkinNote[] } = $props();

  function noteKey(note: SkinNote): string {
    return note.entry.name
      ? `n:${note.entry.name}`
      : `c:${note.entry.content}`;
  }
</script>

{#if notes.length > 0}
  <Accordion.Root type="single" class="mt-4">
    <Accordion.Item value="notes">
      <Accordion.Header class="m-0">
        <Accordion.Trigger
          class="group flex w-full items-center justify-between gap-3 border-b border-border py-2"
        >
          <span class="font-semibold leading-1">Notes</span>
          <ChevronDown
            class="size-4 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content forceMount>
        {#snippet child({ open })}
          {#if open}
            <ol class="list-none py-3 pb-1" transition:slide={{ duration: 150 }}>
              {#each notes as note (noteKey(note))}
                <li class="flex items-start gap-1.5 text-sm not-first:mt-2">
                  <span class="text-[0.75em] text-muted-foreground">
                    [{note.num}]
                  </span>
                  <RenderedHtml
                    html={renderCellHtml(note.entry.content, true)}
                  />
                </li>
              {/each}
            </ol>
          {/if}
        {/snippet}
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
{/if}
