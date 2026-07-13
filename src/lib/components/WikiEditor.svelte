<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { Popover } from "bits-ui";
  import Btn from "./smol/Btn.svelte";
  import Tip from "./smol/Tip.svelte";
  import { Annotation, EditorState } from "@codemirror/state";
  import { lintGutter } from "@codemirror/lint";
  import { EditorView, keymap, lineNumbers } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import {
    defaultHighlightStyle,
    syntaxHighlighting,
  } from "@codemirror/language";
  import { mediawiki } from "@bhsd/codemirror-wikitext";
  import parserConfig from "wikiparser-node/config/default.json" with { type: "json" };
  import type { ConfigData } from "wikiparser-node";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { setWikiOverride } from "$lib/neowtext/wikiSource";
  import { noFetchTowers } from "$lib/services/fetchTowerWiki";
  import { isCustomTower } from "$lib/towerComponents/customTowers";
  import { analytics } from "$lib/services/analytics";

  const syncFromStoreAnnotation = Annotation.define<boolean>();
  const editorTheme = EditorView.theme({
    "&": {
      fontSize: ".75rem",
      lineHeight: "1.25rem",
      color: "var(--foreground)",
      backgroundColor: "transparent",
    },
    "&.cm-editor": {
      maxHeight: "30rem",
      outline: "none",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius) 0 0 0",
      backgroundColor: "var(--background)",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    ".cm-content": {
      padding: ".5rem .75rem",
      caretColor: "var(--foreground)",
    },
    ".cm-gutters": {
      backgroundColor: "color-mix(in oklch, var(--muted) 30%, transparent)",
      color: "var(--muted-foreground)",
      borderRight: "1px solid var(--border)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.25rem",
      padding: "0 .35rem 0 .5rem",
    },
    ".cm-foldGutter .cm-gutterElement": {
      width: "0.85rem",
      padding: "0 .15rem",
    },
    ".cm-panel.cm-panel-lint, .cm-panel-status": {
      borderTop: "1px solid var(--border)",
      backgroundColor:
        "color-mix(in oklch, var(--muted) 25%, var(--background))",
      color: "var(--foreground)",
      fontSize: ".7rem",
    },
    ".cm-panels": {
      zIndex: "37",
    },
    ".cm-panels-bottom, .cm-status-message": {
      borderColor: "var(--accent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in oklch, var(--muted) 50%, transparent)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in oklch, var(--muted) 35%, transparent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent)",
    },
    ".cm-tooltip": {
      border: "1px solid var(--border)",
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
    },
    ".cm-tooltip-section:not(:first-child)": {
      borderTop: "1px solid var(--border)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "var(--accent-foreground)",
    },
    ".cm-diagnosticAction": {
      backgroundColor: "var(--secondary)",
      color: "var(--secondary-foreground)",
    },
  });

  let {
    towerName,
    open = false,
  }: {
    towerName: string;
    open?: boolean;
  } = $props();

  let saving = $state(false);
  let errorMessage = $state<string | null>(null);
  let editorContainer = $state<HTMLElement>();
  let editorView: EditorView | undefined;
  let editorReady = $state(false);

  function syncToStore(doc: string) {
    const dirty = doc !== towerStore.originalWikitext;
    if (doc === towerStore.effectiveWikitext && towerStore.isDirty === dirty) {
      return;
    }

    towerStore.updateSourceWikitext(doc);

    if (settingsStore.debugMode) {
      console.log(
        "[WikiEditor] syncToStore -> effectiveWikitext length:",
        doc.length,
      );
    }
  }

  function setEditorDoc(doc: string) {
    if (!editorView) return;

    const current = editorView.state.doc.toString();
    if (current === doc) return;

    editorView.dispatch({
      changes: { from: 0, to: current.length, insert: doc },
      annotations: syncFromStoreAnnotation.of(true),
    });
  }

  function createEditor(container: HTMLElement) {
    towerStore.guaraWikitextSynced();
    return new EditorView({
      state: EditorState.create({
        doc: towerStore.effectiveWikitext,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          lineNumbers(),
          lintGutter(),
          mediawiki(parserConfig as unknown as ConfigData),
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.lineWrapping,
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (
              !update.docChanged ||
              update.transactions.some((tr) =>
                tr.annotation(syncFromStoreAnnotation),
              )
            ) {
              return;
            }
            syncToStore(update.state.doc.toString());
          }),
        ],
      }),
      parent: container,
    });
  }

  async function discardChanges() {
    if (!towerStore.isDirty) return;

    await towerStore.discardChanges();
    errorMessage = null;
    setEditorDoc(towerStore.effectiveWikitext);
  }

  function saveOverride() {
    if (!towerName) return;

    saving = true;
    errorMessage = null;

    try {
      towerStore.guaraWikitextSynced();
      setWikiOverride(
        profileStore.current,
        towerName,
        towerStore.effectiveWikitext,
      );
      towerStore.isDirty = false;
      void towerStore.forceReload();
    } catch (err) {
      console.error("[WikiEditor] saveOverride error:", err);
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }

  let isFetching = $state(false);

  async function handleFetchWiki() {
    if (!towerName) return;

    isFetching = true;
    try {
      const { fetchTowerWiki } = await import("$lib/services/fetchTowerWiki");
      const { setWikiOverride } = await import("$lib/neowtext/wikiSource");
      const wikitext = await fetchTowerWiki(towerName, true);
      if (wikitext) {
        setWikiOverride(profileStore.current, towerName, wikitext);
        towerStore.isDirty = false;
        await towerStore.forceReload();
        analytics.track("wiki_fetch", {
          tower_name: towerName,
          success: true,
        });
      } else {
        analytics.track("wiki_fetch", {
          tower_name: towerName,
          success: false,
        });
        alert("Failed to fetch wikitext from the Wiki.");
      }
    } catch (e) {
      console.error(e);
      analytics.track("wiki_fetch", {
        tower_name: towerName,
        success: false,
      });
      alert("Error fetching from Wiki.");
    } finally {
      isFetching = false;
    }
  }

  onMount(() => {
    if (!editorContainer) return;

    editorView = createEditor(editorContainer);
    editorReady = true;

    return () => {
      editorView?.destroy();
      editorView = undefined;
      editorReady = false;
    };
  });

  $effect(() => {
    if (!editorReady || !editorView) return;

    towerStore.refreshTrigger;
    untrack(() => {
      towerStore.guaraWikitextSynced();
      setEditorDoc(towerStore.effectiveWikitext);
    });
  });

  const canSave = $derived(
    editorReady &&
      !!towerName &&
      towerStore.effectiveWikitext.trim().length > 0,
  );
</script>

{#if open}
  <div class="flex justify-end gap-2 mb-4">
    {#if !noFetchTowers.has(towerName) && !isCustomTower(towerName)}
      <Popover.Root>
        <Tip content="Fetch latest Neowtext from the TDS Wiki">
          {#snippet children({ props })}
            <Popover.Trigger
              class="btn btn-secondary btn-sm"
              disabled={isFetching || saving}
              {...props}
            >
              {isFetching ? "Fetching..." : "Fetch Latest Data"}
            </Popover.Trigger>
          {/snippet}
        </Tip>
        <Popover.Content class="popover-content">
          <div class="space-y-2">
            <h4 class="font-medium leading-none">Confirm Fetch</h4>
            <p class="text-sm text-muted-foreground">
              Are you sure you want to replace your current data with the latest
              from Tower Defense Simulator Wiki? This will overwrite your local
              changes.
            </p>
          </div>
          <div class="flex justify-end mt-4 gap-2">
            <Popover.Close class="btn btn-outline">Cancel</Popover.Close>
            <Popover.Close class="btn btn-primary" onclick={handleFetchWiki}>
              Confirm
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Root>
    {/if}

    <Btn
      variant="secondary"
      size="sm"
      onclick={() => void discardChanges()}
      disabled={!towerStore.isDirty || saving}
      title="Discard unsaved changes"
    >
      Discard
    </Btn>

    <Popover.Root>
      <Tip
        content={towerStore.sharePreviewId
          ? "Exit share preview or apply from the visual editor first"
          : "Save as profile override"}
      >
        {#snippet children({ props })}
          <Popover.Trigger
            class="btn btn-primary btn-sm"
            disabled={!canSave ||
              !towerStore.isDirty ||
              saving ||
              !!towerStore.sharePreviewId}
            {...props}
          >
            {saving ? "Saving..." : "Save Override"}
          </Popover.Trigger>
        {/snippet}
      </Tip>
      <Popover.Content class="popover-content">
        <div class="space-y-2">
          <h4 class="font-medium leading-none">Confirm Override</h4>
          <p class="text-sm text-muted-foreground">
            This writes the source neowtext directly to your profile and reloads
            the tower, effectively setting a new baseline. This means no new
            delta difference will be taken into account, for example.
          </p>
        </div>
        <div class="flex justify-end mt-4 gap-2">
          <Popover.Close class="btn btn-outline">Cancel</Popover.Close>
          <Popover.Close class="btn btn-primary" onclick={saveOverride}>
            Confirm
          </Popover.Close>
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>

  {#if errorMessage}
    <div
      class="rounded-[var(--radius)_0] border border-red-500/30 bg-red-500/10 p-3"
    >
      <div class="text-sm font-medium text-red-600">Error</div>
      <div class="text-xs text-red-600/90 wrap-break-word mt-1">
        {errorMessage}
      </div>
    </div>
  {/if}

  <div class="space-y-2">
    <div class="wiki-cm-host w-full" bind:this={editorContainer}></div>

    <p class="text-xs text-muted-foreground">
      Notes:
      <br />
      • The source editor uses Neowtext, which includes features such as variables
      and is likely to be unfamiliar to most people. Refer to the
      <a
        href="https://tds.fandom.com/wiki/Help:Neowtext"
        target="_blank"
        rel="noopener"
        class="text-blue-500 underline">help page</a
      >
      to learn more about it.
      <br />
      • This editor does not validate Neowtext or wikitext yet. A malformed table
      may result in missing/incorrect stats.
      <br />
      • The source editor itself is highly experimental. Expect bugs and rough edges,
      and please report any issues you encounter!
    </p>
  </div>
{/if}
