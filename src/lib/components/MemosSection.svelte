<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import CollaspibleMain from "./smol/CollaspibleMain.svelte";
  import RenderedHtml from "./table/RenderedHtml.svelte";
  import { renderWikitextHtml } from "$lib/neowtext/render";
  import { towerStore } from "$lib/stores/tower.svelte";

  let sectionValue = $state("editor-memos");
  let editing = $state(false);
  let draft = $state("");

  const rendered = $derived(renderWikitextHtml(towerStore.editorMemo));

  const focusOnMount: Attachment<HTMLTextAreaElement> = (node) => {
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  };

  function enterEdit(e: MouseEvent | KeyboardEvent) {
    if (editing) return;
    if (e instanceof MouseEvent && (e.target as HTMLElement).closest("a")) {
      return;
    }
    draft = towerStore.editorMemo;
    editing = true;
  }

  function commitEdit() {
    towerStore.setEditorMemo(draft);
    editing = false;
  }

  function cancelEdit() {
    draft = towerStore.editorMemo;
    editing = false;
  }
</script>

{#key towerStore.selectedName}
  <CollaspibleMain
    title="Editor's Memos"
    itemValue="editor-memos"
    bind:value={sectionValue}
  >
    {#if editing}
      <textarea
        class="memo-input mt-3 min-h-24 w-full resize-y"
        bind:value={draft}
        {@attach focusOnMount}
        spellcheck="false"
        onblur={commitEdit}
        onkeydown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit();
          }
        }}
      ></textarea>
    {:else}
      <div
        class="memo-view mt-3"
        role="button"
        tabindex="0"
        onclick={enterEdit}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            enterEdit(e);
          }
        }}
      >
        {#if towerStore.editorMemo.trim()}
          <RenderedHtml html={rendered} block />
        {:else}
          <p class="text-sm text-muted-foreground">
            Have further comments about this tower that you'd like to make
            clear? Write wikitext here!
          </p>
        {/if}
        <span class="memo-hint" aria-hidden="true">Click to edit</span>
      </div>
    {/if}
  </CollaspibleMain>
{/key}

<style>
  .memo-view {
    position: relative;
    min-height: 6rem;
    cursor: text;
    border-radius: calc(var(--radius) - 0.25rem) 0;
    border: 1px solid transparent;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.4;
    transition:
      border-color 0.2s,
      background-color 0.2s;
  }

  .memo-view:hover,
  .memo-view:focus-visible {
    border-color: var(--border);
    background: color-mix(in oklch, var(--accent) 35%, transparent);
    outline: none;
  }

  .memo-hint {
    position: absolute;
    right: 0.75rem;
    bottom: 0.5rem;
    font-size: 0.65rem;
    color: var(--muted-foreground);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }

  .memo-view:hover .memo-hint,
  .memo-view:focus-visible .memo-hint {
    opacity: 1;
  }

  .memo-input {
    border-radius: calc(var(--radius) - 0.25rem) 0;
    border: 1px solid var(--input);
    background: var(--background);
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.4;
    outline: none;
    transition: border-color 0.25s;
  }

  .memo-input:focus-visible {
    border-color: var(--ring);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--ring) 25%, transparent);
  }
</style>
