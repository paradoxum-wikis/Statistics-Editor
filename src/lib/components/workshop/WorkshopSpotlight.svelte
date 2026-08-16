<script lang="ts">
	import type { WorkshopListing } from "$lib/services/workshop";
	import WorkshopCard from "./WorkshopCard.svelte";

	let {
		items,
		onOpen,
	}: {
		items: WorkshopListing[];
		onOpen?: (listing: WorkshopListing) => void;
	} = $props();
</script>

{#if items.length}
	<section class="spotlight" aria-labelledby="spotlight-title">
		<h2 id="spotlight-title">Spotlight</h2>
		<div class="spotlight-grid">
			{#each items as item, i (item.id)}
				<div class:lead={i === 0} class="spotlight-item">
					<WorkshopCard listing={item} {onOpen} compact={i > 0} />
				</div>
			{/each}
		</div>
	</section>
{/if}

<style>
	.spotlight {
		margin-bottom: 1.5rem;

		h2 {
			margin-bottom: 0.6rem;
			font-size: 1.35rem;
			font-weight: 800;
		}
	}

	.spotlight-grid {
		display: grid;
		grid-template-columns: minmax(19rem, 0.9fr) repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;

		@media (max-width: 1050px) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-template-rows: auto;
		}

		@media (max-width: 800px) {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.spotlight-item {
		min-width: 0;

		&.lead {
			grid-row: span 2;
		}

		&:nth-child(4) {
			grid-column: 2 / 4;
		}

		@media (max-width: 1050px) {
			&.lead,
			&:nth-child(4) {
				grid-column: 1 / -1;
				grid-row: auto;
			}
		}

		@media (max-width: 800px) {
			&.lead,
			&:nth-child(4) {
				grid-column: auto;
			}
		}
	}
</style>
