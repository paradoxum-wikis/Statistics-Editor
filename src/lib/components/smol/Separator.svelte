<script lang="ts">
	import { Separator as Sepp } from "bits-ui";

	let {
		ref = $bindable(null),
		orientation = "horizontal",
		class: className,
		...restProps
	}: {
		ref?: HTMLElement | null;
		orientation?: "horizontal" | "vertical";
		class?: string;
		[key: string]: any;
	} = $props();
</script>

<Sepp.Root
	bind:ref
	{orientation}
	class="bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px {className ??
		''}"
	{...restProps}
/>
