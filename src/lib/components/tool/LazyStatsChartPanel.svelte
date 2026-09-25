<script lang="ts">
	let { open }: { open: boolean } = $props();
</script>

{#if open}
	{#await import("./StatsChartPanel.svelte")}
		<div class="p-8 text-center text-sm text-muted-foreground" role="status">
			Loading comparator…
		</div>
	{:then { default: ChartPanel }}
		<ChartPanel />
	{:catch error}
		<div class="p-8 text-center text-sm text-destructive" role="alert">
			Failed to load the comparator. Close and reopen it to try again.
			<span class="sr-only">{String(error)}</span>
		</div>
	{/await}
{/if}
