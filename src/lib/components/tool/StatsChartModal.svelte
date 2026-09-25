<script lang="ts">
	import Modal from "$lib/components/smol/Modal.svelte";
	import LazyStatsChartPanel from "./LazyStatsChartPanel.svelte";

	let { open = $bindable(false) } = $props();
</script>

<Modal bind:open class="sm:max-w-2xl">
	<LazyStatsChartPanel {open} />
</Modal>
