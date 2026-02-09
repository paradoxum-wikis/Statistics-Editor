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

	let text = $state("");
	let dirty = $state(false);
	let status = $state<
		"idle" | "loading" | "ready" | "saving" | "saved" | "error"
	>("idle");
	let errorMessage = $state<string | null>(null);

	let profileName = $derived(profileStore.current);

	let sourceLabel = $derived(
		towerStore.effectiveWikitextSource
			? `Using ${towerStore.effectiveWikitextSource} wiki`
			: "Using loaded wiki",
	);

	function onInput(e: Event) {
		text = (e.currentTarget as HTMLTextAreaElement).value;
		dirty = true;
		status = "ready";
		if (settingsStore.debugMode) {
			console.log(
				"[WikiEditor] onInput updating effectiveWikitext, length:",
				text.length,
			);
		}
		towerStore.effectiveWikitext = text;
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

			dirty = false;
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
		if (!dirty) return;

		const tower = towerStore.selectedData as unknown as {
			sourceWikitext?: string;
		};
		const original = tower?.sourceWikitext ?? "";

		text = original;
		towerStore.effectiveWikitext = original;
		dirty = false;
		status = "ready";
		errorMessage = null;
	}

	onMount(() => {
		isClient = true;
	});

	$effect(() => {
		if (!isClient) return;
		if (dirty) return;

		if (settingsStore.debugMode) {
			console.log(
				"[WikiEditor] Effect syncing text from store. Length:",
				towerStore.effectiveWikitext.length,
			);
		}
		text = towerStore.effectiveWikitext;
		status = "ready";
		errorMessage = null;
	});

	const canSave = $derived(isClient && !!towerName && text.trim().length > 0);
</script>

{#if open}
	<div class="card p-6 space-y-4">
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
				<button
					class="btn-secondary text-sm px-3 py-1"
					onclick={discardChanges}
					disabled={!dirty || status === "saving"}
					title="Discard unsaved changes (revert to last loaded effective wiki)"
				>
					Discard
				</button>

				<button
					class="btn-secondary text-sm px-3 py-1"
					onclick={saveOverride}
					disabled={!canSave ||
						status === "loading" ||
						status === "saving"}
					title="Save as profile-specific override and reload tower"
				>
					Save override
				</button>
			</div>
		</div>

		{#if errorMessage}
			<div class="rounded-md border border-red-500/30 bg-red-500/10 p-3">
				<div class="text-sm font-medium text-red-600">Error</div>
				<div class="text-xs text-red-600/90 wrap-break-word mt-1">
					{errorMessage}
				</div>
			</div>
		{/if}

		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<div class="text-xs text-muted-foreground">
					{#if status === "loading"}
						Loading...
					{:else if status === "saving"}
						Saving...
					{:else if status === "saved"}
						Saved override.
					{:else if dirty}
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

			<textarea
				class="input w-full font-mono text-xs leading-5 min-h-105"
				value={text}
				oninput={onInput}
				spellcheck="false"
				autocapitalize="off"
				autocomplete="off"
			></textarea>

			<p class="text-xs text-muted-foreground">
				Notes:
				<br />
				• Saving writes a profile-specific override to localStorage and forces
				a tower reload so formulas/tokens re-parse from the edited source.
				<br />
				• This editor does not validate wikitext yet. A malformed table may
				result in missing/incorrect stats.
			</p>
		</div>
	</div>
{/if}
