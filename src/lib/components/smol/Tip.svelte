<script lang="ts">
	import { Tooltip as JustTheTip } from "bits-ui";
	import type { Snippet } from "svelte";

	let {
		content,
		side = "top",
		sideOffset = 6,
		class: className = "",
		children,
	}: {
		content?: string | Snippet;
		side?: "top" | "bottom" | "left" | "right";
		sideOffset?: number;
		class?: string;
		children: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();
</script>

<JustTheTip.Root>
	<JustTheTip.Trigger>
		{#snippet child({ props })}
			{@render children({ props })}
		{/snippet}
	</JustTheTip.Trigger>
	<JustTheTip.Portal>
		<JustTheTip.Content class="tip {className}" {side} {sideOffset}>
			{#if typeof content === "string"}
				{content}
			{:else if content}
				{@render content()}
			{/if}
		</JustTheTip.Content>
	</JustTheTip.Portal>
</JustTheTip.Root>

<style>
	:global(.tip) {
		z-index: 67;
		max-width: 14rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--popover);
		color: var(--popover-foreground);
		padding: 6px 10px;
		font-size: 13px;
		font-weight: 500;

		&[data-state="delayed-open"] {
			animation: overlay-in 0.15s;
		}

		&[data-state="closed"] {
			animation: overlay-out 0.1s;
		}
	}
</style>
