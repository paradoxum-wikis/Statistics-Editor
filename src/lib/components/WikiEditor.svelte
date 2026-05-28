<script lang="ts">
  import { onMount } from "svelte";
  import { Popover } from "bits-ui";
  import { EditorState } from "@codemirror/state";
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
  import { noFetchTowers } from "$lib/towerComponents/towers/index";

  let {
    towerName,
    open = false,
  }: {
    towerName: string;
    open?: boolean;
  } = $props();

  let isClient = $state(false);
  let text = $state(towerStore.effectiveWikitext);
  let status = $state<"ready" | "saving" | "saved" | "error">("ready");
  let errorMessage = $state<string | null>(null);
  let editorContainer = $state<HTMLElement>();
  let editorView: EditorView | undefined;
  let syncingFromStore = $state(false);

  let profileName = $derived(profileStore.current);

  let sourceLabel = $derived(
    towerStore.effectiveWikitextSource
      ? `Using ${towerStore.effectiveWikitextSource} wiki`
      : "Using loaded wiki",
  );

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
  });

  function syncToStore(doc: string) {
    if (syncingFromStore) return;

    text = doc;
    status = "ready";
    towerStore.effectiveWikitext = doc;
    towerStore.isDirty = doc !== towerStore.originalWikitext;

    if (settingsStore.debugMode) {
      console.log(
        "[WikiEditor] syncToStore -> effectiveWikitext length:",
        doc.length,
      );
      console.log(
        "[WikiEditor] syncToStore -> has <var>:",
        /<var\b/i.test(doc),
      );
      console.log("[WikiEditor] syncToStore -> preview:", doc.slice(0, 200));
    }
  }

  function setEditorDoc(doc: string) {
    if (!editorView) return;

    const current = editorView.state.doc.toString();
    if (current === doc) return;

    syncingFromStore = true;
    editorView.dispatch({
      changes: { from: 0, to: current.length, insert: doc },
    });
    syncingFromStore = false;
  }

  function createEditor(container: HTMLElement) {
    return new EditorView({
      state: EditorState.create({
        doc: text,
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
            if (update.docChanged) {
              syncToStore(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: container,
    });
  }

  function saveOverride() {
    if (!towerName) return;

    if (settingsStore.debugMode)
      console.log("[WikiEditor] saveOverride initiated");
    status = "saving";
    errorMessage = null;

    try {
      if (settingsStore.debugMode) {
        console.log(
          "[WikiEditor] saving wikitext length:",
          towerStore.effectiveWikitext.length,
        );
        console.log(
          "[WikiEditor] saving wikitext has <var>:",
          /<var\b/i.test(towerStore.effectiveWikitext),
        );
        console.log(
          "[WikiEditor] saving wikitext preview:",
          towerStore.effectiveWikitext.slice(0, 200),
        );
      }

      setWikiOverride(profileName, towerName, towerStore.effectiveWikitext);

      if (settingsStore.debugMode)
        console.log("[WikiEditor] setWikiOverride returned");

      towerStore.isDirty = false;
      status = "saved";

      if (settingsStore.debugMode)
        console.log("[WikiEditor] calling forceReload");

      void towerStore.forceReload().then(() => {
        if (settingsStore.debugMode)
          console.log("[WikiEditor] forceReload resolved");
      });
    } catch (err) {
      console.error("[WikiEditor] saveOverride error:", err);
      status = "error";
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  let isFetching = $state(false);

  async function handleFetchWiki() {
    if (!towerName) return;

    isFetching = true;
    try {
      const { fetchTowerWiki } =
        await import("$lib/towerComponents/towers/index");
      const { setWikiOverride } = await import("$lib/neowtext/wikiSource");
      const wikitext = await fetchTowerWiki(towerName, true);
      if (wikitext) {
        setWikiOverride(profileStore.current, towerName, wikitext);
        towerStore.isDirty = false;
        await towerStore.forceReload();
      } else {
        alert("Failed to fetch wikitext from the Wiki.");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching from Wiki.");
    } finally {
      isFetching = false;
    }
  }

  function discardChanges() {
    if (!towerStore.isDirty) return;

    text = towerStore.originalWikitext;
    towerStore.effectiveWikitext = towerStore.originalWikitext;
    towerStore.isDirty = false;
    status = "ready";
    errorMessage = null;
    setEditorDoc(towerStore.originalWikitext);
  }

  onMount(() => {
    isClient = true;

    if (editorContainer) {
      editorView = createEditor(editorContainer);
      setEditorDoc(towerStore.effectiveWikitext);
      return () => {
        editorView?.destroy();
        editorView = undefined;
      };
    }

    return;
  });

  $effect(() => {
    if (!isClient) return;

    const next = towerStore.effectiveWikitext;
    if (text !== next) text = next;
    setEditorDoc(next);

    if (settingsStore.debugMode) {
      console.log(
        "[WikiEditor] Effect syncing text from store. Length:",
        next.length,
      );
    }
    status = "ready";
    errorMessage = null;
  });

  const canSave = $derived(isClient && !!towerName && text.trim().length > 0);
</script>

{#if open}
  <div class="flex items-start justify-between gap-4">
    <div class="space-y-1">
      <p class="text-sm text-muted-foreground">
        Editing:
        <span class="font-medium text-foreground">
          {towerName}
        </span>
        · Profile:
        <span class="font-medium text-foreground">
          {profileName}
        </span>
        · <span class="text-muted-foreground">{sourceLabel}</span>
      </p>
    </div>

    <div class="flex items-center gap-2">
      {#if !noFetchTowers.has(towerName)}
        <Popover.Root>
          <Popover.Trigger
            class="btn btn-secondary btn-sm"
            disabled={isFetching || status === "saving"}
            title="Fetch latest wikitext from the Wiki"
          >
            {isFetching ? "Fetching..." : "Fetch Latest Data"}
          </Popover.Trigger>
          <Popover.Content class="popover-content">
            <div class="space-y-2">
              <h4 class="font-medium leading-none">Confirm Fetch</h4>
              <p class="text-sm text-muted-foreground">
                Are you sure you want to replace your current data with the
                latest from Tower Defense Simulator Wiki? This will overwrite
                your local changes.
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

      <button
        class="btn btn-secondary btn-sm"
        onclick={discardChanges}
        disabled={!towerStore.isDirty || status === "saving"}
        title="Discard unsaved changes (revert to last loaded effective wiki)"
      >
        Discard
      </button>

      <button
        class="btn btn-primary btn-sm"
        onclick={saveOverride}
        disabled={!canSave || !towerStore.isDirty || status === "saving"}
        title="Save as profile-specific override and reload tower"
      >
        Save override
      </button>
    </div>
  </div>

  {#if errorMessage}
    <div
      class="[border-radius:var(--radius)_0] border border-red-500/30 bg-red-500/10 p-3"
    >
      <div class="text-sm font-medium text-red-600">Error</div>
      <div class="text-xs text-red-600/90 break-words mt-1">
        {errorMessage}
      </div>
    </div>
  {/if}

  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <div class="text-xs text-muted-foreground">
        {#if status === "saving"}
          Saving...
        {:else if status === "saved"}
          Saved override.
        {:else if towerStore.isDirty}
          Unsaved changes
        {:else}
          Ready
        {/if}
      </div>

      {#if settingsStore.debugMode}
        <div class="text-xs text-muted-foreground">
          Length: {text.length}
        </div>
      {/if}
    </div>

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
