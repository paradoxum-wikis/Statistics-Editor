<script lang="ts">
  import { Tooltip } from "bits-ui";
  import { renderCellHtml } from "$lib/neowtext/render";
  import type { RefEntry } from "$lib/towerTable";
  import RenderedHtml from "./RenderedHtml.svelte";

  let {
    value,
    readOnly,
    entries,
    getRefNum,
  }: {
    value: string | number | null | undefined;
    readOnly: boolean;
    entries: RefEntry[];
    getRefNum: (content: string, name?: string | null) => number;
  } = $props();
</script>

<RenderedHtml
  html={renderCellHtml(value, readOnly)}
/>{#each entries as entry (entry.name ? `n:${entry.name}` : `c:${entry.content}`)}{@const n =
    getRefNum(entry.content, entry.name)}<Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <sup class="ref-sup" {...props}>[{n}]</sup>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        class="tooltip-content max-w-72! text-sm"
        side="top"
        sideOffset={4}
      >
        <RenderedHtml html={renderCellHtml(entry.content, true)} />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>{/each}

<style>
  .ref-sup {
    font-size: 0.6em;
    line-height: 1;
    vertical-align: super;
    padding-inline: 0.08em;
    color: var(--muted-foreground);
    cursor: help;
    user-select: none;
    font-weight: 500;

    &:hover {
      color: var(--foreground);
    }
  }
</style>
