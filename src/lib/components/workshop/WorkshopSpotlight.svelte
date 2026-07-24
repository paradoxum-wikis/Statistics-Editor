<script lang="ts">
  import type { WorkshopListing } from "$lib/services/workshop";
  import Slider from "../smol/Slider.svelte";
  import WorkshopCard from "./WorkshopCard.svelte";

  let {
    items,
    onOpen,
  }: {
    items: WorkshopListing[];
    onOpen?: (listing: WorkshopListing) => void;
  } = $props();
</script>

<Slider
  class="mb-5"
  {items}
  getKey={(item: WorkshopListing) => item.id}
  label="Workshop spotlight"
  title="Today's Spotlight"
  maxPerView={2}
>
  {#snippet slide({ item }: { item: WorkshopListing; index: number })}
    <WorkshopCard listing={item} {onOpen} compact />
  {/snippet}
</Slider>
