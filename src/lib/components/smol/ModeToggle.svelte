<script lang="ts">
	import { tick } from "svelte";
	import { FileBraces, Table } from "@lucide/svelte";
	import { mergeProps } from "bits-ui";
	import { towerStore } from "$lib/stores/tower.svelte";
	import { analytics } from "$lib/services/analytics";
	import { tabPill } from "$lib/utils/tabPill.svelte";
	import { lintNeowtext } from "$lib/neowtext/codemirror/lint";
	import Tip from "./Tip.svelte";

	let {
		mode = $bindable<"cells" | "wiki">("cells"),
		disableCells = false,
		onModeChange,
		class: className = "",
	}: {
		mode?: "cells" | "wiki";
		disableCells?: boolean;
		onModeChange?: (mode: "cells" | "wiki") => void;
		class?: string;
	} = $props();

	async function switchToCells() {
		onModeChange?.("cells");
		mode = "cells";
		analytics.track("editor_mode", { mode: "cells" });
		await tick();
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);
		await towerStore.applyWikiWikitext();
	}

	function switchToWiki() {
		towerStore.guaraWikitextSynced();
		onModeChange?.("wiki");
		mode = "wiki";
		analytics.track("editor_mode", { mode: "wiki" });
	}

	const sourceLint = $derived.by(() => {
		let warning = false;
		for (const d of lintNeowtext(towerStore.effectiveWikitext)) {
			if (d.severity === "error") return "error";
			if (d.severity === "warning") warning = true;
		}
		return warning ? "warning" : null;
	});
</script>

<div class="tabs-list {className}" use:tabPill={() => ({ mode, disableCells })}>
	<button
		class="tabs-trigger {mode === 'cells' && !disableCells ? 'active' : ''}"
		onclick={() => void switchToCells()}
		disabled={disableCells}
	>
		<Table size={16} />
		<span>Visual</span>
	</button>
	{#snippet sourceTab(tipProps?: Record<string, unknown>)}
		<button
			class="tabs-trigger {mode === 'wiki' || disableCells ? 'active' : ''}"
			{...mergeProps(tipProps ?? {}, { onclick: switchToWiki })}
		>
			<FileBraces size={16} />
			<span>Source</span>
			{#if sourceLint}
				<span class="source-lint {sourceLint}" aria-hidden="true"></span>
			{/if}
		</button>
	{/snippet}
	{#if sourceLint}
		<Tip
			content={sourceLint === "error"
				? "Source has errors"
				: "Source has warnings"}
		>
			{#snippet children({ props })}
				{@render sourceTab(props)}
			{/snippet}
		</Tip>
	{:else}
		{@render sourceTab()}
	{/if}
</div>

<style>
	.source-lint {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 7;
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		pointer-events: none;

		&.error {
			background: var(--destructive);
		}

		&.warning {
			background: var(--yellow-dark);
		}
	}
</style>
