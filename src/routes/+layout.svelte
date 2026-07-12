<script>
  import { onMount } from "svelte";
  import { Tooltip } from "bits-ui";
  import { analytics } from "$lib/services/analytics";
  import { towerStore } from "$lib/stores/tower.svelte";
  import Toaster from "$lib/components/smol/Toaster.svelte";
  import "./layout.css";

  let { children } = $props();

  const pageTitle = $derived(
    towerStore.selectedName
      ? `${towerStore.selectedName} | TDS Statistics Editor`
      : "TDS Statistics Editor",
  );

  onMount(() => {
    analytics.init();
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
    rel="stylesheet"
  />
  <link
    rel="stylesheet"
    href="https://bin.t7ru.link/fol/unisans/index.css"
    crossorigin="anonymous"
  />
</svelte:head>

<Tooltip.Provider delayDuration={200} skipDelayDuration={300}>
  {@render children()}
</Tooltip.Provider>
<Toaster />
