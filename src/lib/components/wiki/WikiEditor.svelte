<script lang="ts">
	import { onMount } from "svelte";
	import { towerStore } from "$lib/stores/tower.svelte";
	import { profileStore } from "$lib/stores/profile.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { setWikiOverride } from "$lib/wiki/wikiSource";

	let {
		towerName,
		open = false,
	}: {
		towerName: string;
		open?: boolean;
	} = $props();

	let isClient = $state(false);

	let text = $state(towerStore.effectiveWikitext);
	let status = $state<
		"ready" | "saving" | "saved" | "error"
	>("ready");
	let errorMessage = $state<string | null>(null);

	let profileName = $derived(profileStore.current);

	let sourceLabel = $derived(
		towerStore.effectiveWikitextSource
			? `Using ${towerStore.effectiveWikitextSource} wiki`
			: "Using loaded wiki",
	);

	function onInput(e: Event) {
		text = (e.currentTarget as HTMLTextAreaElement).value;
		status = "ready";
		if (settingsStore.debugMode) {
			console.log(
				"[WikiEditor] onInput updating effectiveWikitext, length:",
				text.length,
			);
		}
		towerStore.effectiveWikitext = text;
		towerStore.isDirty = true;
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
	}

	onMount(() => {
		isClient = true;
	});

	$effect(() => {
		if (!isClient) return;
		if (text !== towerStore.effectiveWikitext) {
			text = towerStore.effectiveWikitext;
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

			<textarea
				class="wiki-textarea"
				value={text}
				oninput={onInput}
				spellcheck="false"
				autocapitalize="off"
				autocomplete="off"
			></textarea>

			<p class="wiki-notes-text">
				Notes:
				<br />
				• Saving writes a profile-specific override to localStorage and forces
				a tower reload so formulas/tokens re-parse from the edited source.
				<br />
				• This editor does not validate wikitext yet. A malformed table may
				result in missing/incorrect stats.
			</p>
		</div>
{/if}
