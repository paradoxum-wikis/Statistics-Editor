<script lang="ts">
	import type { Snippet } from "svelte";
	import type { WikiTemplate as T } from "./index";

	let {
		t,
		body,
		faded,
		children,
	}: {
		t: T;
		body?: string;
		faded?: boolean;
		children?: Snippet;
	} = $props();
</script>

<span class="wiki-template" style:--template-color={t.color}>
	<enhanced:img
		src={t.icon}
		alt=""
		class={["wiki-template-icon", faded && "opacity-75"]}
	/>{#if children}{@render children()}{:else}{body}{/if}{t.suffix}
</span>
