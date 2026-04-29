<script lang="ts">
  import { onMount } from "svelte";
  import { Popover } from "bits-ui";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { setWikiOverride } from "$lib/neowtext/wikiSource";
  import { noFetchTowers } from "$lib/towerComponents/towers/index";
  import {
    WikitextEditor,
    DEFAULT_EXTENSION_TAGS,
    DEFAULT_CONTENT_PRESERVING_TAGS,
  } from "wikistxr";

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
  let editor = $state<WikitextEditor>();
  let pendingDomSyncFrame = $state<number | null>(null);

  let profileName = $derived(profileStore.current);

  let sourceLabel = $derived(
    towerStore.effectiveWikitextSource
      ? `Using ${towerStore.effectiveWikitextSource} wiki`
      : "Using loaded wiki",
  );

  function readEditorTextFromDom(container: HTMLElement): string {
    const lineEls = Array.from(
      container.querySelectorAll<HTMLElement>(".wt-line"),
    );

    if (settingsStore.debugMode && lineEls.length > 0) {
      console.log(
        "[WikiEditor] readEditorTextFromDom -> first lines diagnostics:",
        lineEls.slice(0, 3).map((el, index) => ({
          index,
          textContent: (el.textContent ?? "").replace(/\u200B/g, ""),
          innerText: (el.innerText ?? "").replace(/\u200B/g, ""),
          innerHTML: el.innerHTML,
        })),
      );
    }

    if (lineEls.length > 0) {
      return lineEls
        .map((el) => (el.textContent ?? "").replace(/\u200B/g, ""))
        .join("\n");
    }

    return (container.innerText ?? "").replace(/\r\n/g, "\n");
  }

  function scheduleSyncFromEditorDom() {
    if (pendingDomSyncFrame != null) return;

    pendingDomSyncFrame = requestAnimationFrame(() => {
      pendingDomSyncFrame = null;
      syncFromEditorDom();
    });
  }

  function syncFromEditorDom() {
    if (!editorContainer) return;

    const nextText = readEditorTextFromDom(editorContainer);

    if (nextText !== text) {
      text = nextText;
    }

    status = "ready";
    towerStore.effectiveWikitext = nextText;
    towerStore.isDirty = nextText !== towerStore.originalWikitext;

    if (settingsStore.debugMode) {
      console.log(
        "[WikiEditor] syncFromEditorDom -> effectiveWikitext length:",
        nextText.length,
      );
      console.log(
        "[WikiEditor] syncFromEditorDom -> has <var>:",
        /<var\b/i.test(nextText),
      );
      console.log(
        "[WikiEditor] syncFromEditorDom -> preview:",
        nextText.slice(0, 200),
      );
    }
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

    if (editor) {
      editor.update(text);
    }
  }

  onMount(() => {
    isClient = true;

    if (isClient && editorContainer) {
      if (!document.getElementById("wikistxr-styles")) {
        const style = document.createElement("style");
        style.id = "wikistxr-styles";
        style.textContent = WikitextEditor.getDefaultStyles();
        document.head.appendChild(style);
      }

      editor = new WikitextEditor({
        extensionTags: [...DEFAULT_EXTENSION_TAGS, "var"],
        contentPreservingTags: [...DEFAULT_CONTENT_PRESERVING_TAGS, "var"],
      });

      if (settingsStore.debugMode) {
        editor.debug = (event) => {
          if (
            event.type === "attach" ||
            event.type === "input" ||
            event.type === "extractLines:done" ||
            event.type === "warn"
          ) {
            console.log("[WikiEditor][wikistxr]", event);
          }
        };
      }

      editor.attach(editorContainer);
      editor.update(text);

      const editorInputHandler = () => scheduleSyncFromEditorDom();
      const observer = new MutationObserver(() => scheduleSyncFromEditorDom());
      editorContainer.addEventListener("input", editorInputHandler);
      editorContainer.addEventListener("beforeinput", editorInputHandler);
      editorContainer.addEventListener("paste", editorInputHandler);
      editorContainer.addEventListener("cut", editorInputHandler);
      editorContainer.addEventListener("drop", editorInputHandler);
      observer.observe(editorContainer, {
        subtree: true,
        childList: true,
        characterData: true,
      });

      return () => {
        observer.disconnect();
        editorContainer?.removeEventListener("input", editorInputHandler);
        editorContainer?.removeEventListener("beforeinput", editorInputHandler);
        editorContainer?.removeEventListener("paste", editorInputHandler);
        editorContainer?.removeEventListener("cut", editorInputHandler);
        editorContainer?.removeEventListener("drop", editorInputHandler);
        if (pendingDomSyncFrame != null) {
          cancelAnimationFrame(pendingDomSyncFrame);
          pendingDomSyncFrame = null;
        }
      };
    }

    return;
  });

  $effect(() => {
    if (!isClient) return;
    if (text !== towerStore.effectiveWikitext) {
      text = towerStore.effectiveWikitext;
      if (editor) {
        editor.update(text);
      }
    }

    if (settingsStore.debugMode) {
      console.log(
        "[WikiEditor] Effect syncing text from store. Length:",
        towerStore.effectiveWikitext.length,
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
    <div class="[border-radius:var(--radius)_0] border border-red-500/30 bg-red-500/10 p-3">
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

    <div
      class="[border-radius:var(--radius)_0] border border-input bg-background px-4 py-2 outline-none max-h-[30rem] overflow-auto transition-colors w-full font-mono text-xs leading-5"
      bind:this={editorContainer}
      spellcheck="false"
    ></div>

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

