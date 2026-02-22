<script lang="ts">
	import { onMount } from "svelte";
	import { towerStore } from "$lib/stores/tower.svelte";
	import { profileStore } from "$lib/stores/profile.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { setWikiOverride } from "$lib/wikitext/wikiSource";
	import { WikitextEditor } from "wikistxr";

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

		if (lineEls.length > 0) {
			return lineEls
				.map((el) => (el.textContent ?? "").replace(/\u200B/g, ""))
				.join("\n");
		}

		return (container.innerText ?? "").replace(/\r\n/g, "\n");
	}

	function syncFromEditorDom() {
		if (!editorContainer) return;

		const nextText = readEditorTextFromDom(editorContainer);

		if (nextText !== text) {
			text = nextText;
		}

		status = "ready";
		towerStore.effectiveWikitext = nextText;
		towerStore.isDirty = true;

		if (settingsStore.debugMode) {
			console.log(
				"[WikiEditor] syncFromEditorDom -> effectiveWikitext length:",
				nextText.length,
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
			}

			setWikiOverride(
				profileName,
				towerName,
				towerStore.effectiveWikitext,
			);

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

			editor = new WikitextEditor();
			editor.attach(editorContainer);
			editor.update(text);

			const editorInputHandler = () => syncFromEditorDom();
			editorContainer.addEventListener("input", editorInputHandler);

			return () => {
				editorContainer?.removeEventListener("input", editorInputHandler);
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
	<div class="wiki-header-row">
		<div class="wiki-info-group">
			<p class="wiki-info-text">
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

		<div class="wiki-actions-group">
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
				disabled={!canSave ||
					!towerStore.isDirty ||
					status === "saving"}
				title="Save as profile-specific override and reload tower"
			>
				Save override
			</button>
		</div>
	</div>

	{#if errorMessage}
		<div class="wiki-error-box">
			<div class="wiki-error-title">Error</div>
			<div class="wiki-error-body">
				{errorMessage}
			</div>
		</div>
	{/if}

	<div class="space-y-2">
		<div class="wiki-status-row">
			<div class="wiki-status-text">
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
				<div class="wiki-status-text">
					Length: {text.length}
				</div>
			{/if}
		</div>

		<div
			class="wiki-textarea"
			bind:this={editorContainer}
			spellcheck="false"
		></div>

		<p class="wiki-notes-text">
			Notes:
			<br />
			• The source editor uses Neowtext, which includes features such as variables and is likely to be unfamiliar to most people. Refer to the <a href="https://tds.fandom.com/wiki/Help:Neowtext" target="_blank" rel="noopener" class="text-blue-500 underline">help page</a> to learn more about it.
			<br />
			• This editor does not validate Neowtext or wikitext yet. A malformed table may result
			in missing/incorrect stats.
			<br />
			• The source editor itself is highly experimental. Expect bugs and rough edges, and please report any issues you encounter!
		</p>
	</div>
{/if}

<style>
	@reference "../../routes/layout.css";

	.wiki-header-row {
		@apply flex items-start justify-between gap-4;
	}

	.wiki-info-group {
		@apply space-y-1;
	}

	.wiki-info-text {
		@apply text-sm text-muted-foreground;
	}

	.wiki-actions-group {
		@apply flex items-center gap-2;
	}

	.wiki-error-box {
		border-radius: var(--radius) 0;
		@apply border border-red-500/30 bg-red-500/10 p-3;
	}

	.wiki-error-title {
		@apply text-sm font-medium text-red-600;
	}

	.wiki-error-body {
		@apply text-xs text-red-600/90 wrap-break-word mt-1;
	}

	.wiki-status-row {
		@apply flex items-center justify-between;
	}

	.wiki-status-text {
		@apply text-xs text-muted-foreground;
	}

	.wiki-textarea {
		border-radius: var(--radius) 0;
		border: 1px solid var(--input);
		background: var(--background);
		padding: 0.5rem 1rem;
		outline: none;
		max-height: 30rem;
		overflow: auto;
		transition:
			border-color 0.2s;
		@apply w-full font-mono text-xs leading-5;
	}

	.wiki-notes-text {
		@apply text-xs text-muted-foreground;
	}
</style>
