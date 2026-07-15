<script>
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Tooltip } from "bits-ui";
  import { analytics } from "$lib/services/analytics";
  import { bootstrap } from "$lib/bootstrap";
  import DesktopLayout from "$lib/components/DesktopLayout.svelte";
  import MobileLayout from "$lib/components/MobileLayout.svelte";
  import Toaster from "$lib/components/smol/Toaster.svelte";
  import "./layout.css";

  let { children } = $props();
  let isClient = $state(false);

  const siteName = "TDS Statistics Editor";
  const siteUrl = "https://se.tds.wiki/";
  const defaultDescription =
    "Edit and balance towers for the Roblox game Tower Defense Simulator and export it to the wiki!";
  const ogImage = `${siteUrl}ogimg.png`;
  const ogImageAlt =
    "TDS Statistics Editor - modify, balance, or just, mess around!";

  const towerName = $derived(page.params.name);
  const pageTitle = $derived(
    towerName ? `${towerName} | ${siteName}` : siteName,
  );
  const description = $derived(
    towerName
      ? `Edit ${towerName} stats in the TDS Statistics Editor for the Roblox game Tower Defense Simulator!`
      : defaultDescription,
  );

  onMount(async () => {
    analytics.init();
    await bootstrap();
    isClient = true;
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={siteUrl} />

  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={siteUrl} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:locale" content="en_US" />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={ogImageAlt} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@isALTEREGOout" />
  <meta name="twitter:image:alt" content={ogImageAlt} />

  <meta name="theme-color" content="#33577a" />
  <meta name="apple-mobile-web-app-title" content="TDS:SE" />

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

<svelte:window
  onbeforeunload={(e) => {
    if (!towerStore.isDirty) return;
    e.preventDefault();
  }}
/>

<Tooltip.Provider delayDuration={200} skipDelayDuration={300}>
  {@render children()}
  <div class="hidden md:flex h-screen flex-col">
    <DesktopLayout {isClient} />
  </div>
  <div class="md:hidden">
    <MobileLayout {isClient} />
  </div>
</Tooltip.Provider>
<Toaster />
