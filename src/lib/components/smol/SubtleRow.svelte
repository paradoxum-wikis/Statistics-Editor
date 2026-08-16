<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		class: className = "",
		children,
		...restProps
	}: {
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<div
	class="rounded-(--radius) border border-border bg-card {className}"
	{...restProps}
>
	{@render children()}
</div>
