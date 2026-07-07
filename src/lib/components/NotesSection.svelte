<script lang="ts">
  import { renderCellHtml } from "$lib/neowtext/render";
  import RenderedHtml from "./table/RenderedHtml.svelte";
  import CollaspibleMain from "./smol/CollaspibleMain.svelte";
  import type { SkinNote } from "$lib/towerTable";

  let { notes }: { notes: SkinNote[] } = $props();

  function noteKey(note: SkinNote): string {
    return note.entry.name ? `n:${note.entry.name}` : `c:${note.entry.content}`;
  }
</script>

{#if notes.length > 0}
  <CollaspibleMain title="Notes" itemValue="notes">
    <ol class="list-none py-3 pb-1">
      {#each notes as note (noteKey(note))}
        <li class="flex gap-1 text-sm not-first:mt-2">
          <span class="text-[0.75em] text-muted-foreground">
            [{note.num}]
          </span>
          <RenderedHtml html={renderCellHtml(note.entry.content, true)} />
        </li>
      {/each}
    </ol>
  </CollaspibleMain>
{/if}
