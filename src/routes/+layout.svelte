<script>
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";
	import { page } from "$app/state";
	import { MediaQuery } from "svelte/reactivity";
	import { Tooltip } from "bits-ui";
	import { analytics } from "$lib/services/analytics";
	import { bootstrap } from "$lib/bootstrap";
	import { towerStore } from "$lib/stores/tower.svelte";
	import DesktopLayout from "$lib/components/DesktopLayout.svelte";
	import MobileLayout from "$lib/components/MobileLayout.svelte";
	import Toaster from "$lib/components/smol/Toaster.svelte";
	import AnnouncementsModal from "$lib/components/AnnouncementsModal.svelte";
	import InboxModal from "$lib/components/InboxModal.svelte";
	import "./layout.css";
	import "@fontsource-variable/montserrat/wght.css";

	let { children } = $props();
	let isClient = $state(false);
	const desktop = new MediaQuery("min-width: 768px");

	const siteName = "TDS Statistics Editor";
	const siteUrl = "https://se.tds.wiki/";
	const defaultDescription =
		"Edit and balance towers for the Roblox game Tower Defense Simulator and export it to the wiki!";
	const ogImage = `${siteUrl}ogimg.png`;
	const ogImageAlt =
		"TDS Statistics Editor - modify, balance, or just, mess around!";

	const towerName = $derived(towerStore.selectedName || page.params.name || "");
	const isWorkshop = $derived(page.url.pathname.startsWith("/workshop"));
	const isAdmin = $derived(page.url.pathname.startsWith("/admin"));
	const isStandalone = $derived(isWorkshop || isAdmin);
	const notFound = $derived(page.status >= 400 || towerStore.missingTower);
	// keep title here only
	// as page-level <title> can stick after client nav
	const pageTitle = $derived(
		notFound
			? `404 Not Found | ${siteName}`
			: isAdmin
				? `Admin | ${siteName}`
				: isWorkshop
					? `Workshop | ${siteName}`
					: towerName
						? `${towerName} | ${siteName}`
						: siteName,
	);
	const description = $derived(
		notFound
			? "Sorry, the page you're looking for doesn't exist."
			: isAdmin
				? "Workshop admin for the TDS Statistics Editor."
				: isWorkshop
					? "Make, browse and share community tower stats in the TDS Statistics Editor Workshop!"
					: towerName
						? `Edit ${towerName} stats in the TDS Statistics Editor for the Roblox game Tower Defense Simulator!`
						: defaultDescription,
	);
	const pageUrl = $derived(
		isAdmin
			? `${siteUrl}admin`
			: isWorkshop
				? `${siteUrl}workshop`
				: towerName
					? `${siteUrl}tower/${encodeURIComponent(towerName)}`
					: siteUrl,
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
	<link rel="canonical" href={pageUrl} />

	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:site_name" content={siteName} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={ogImageAlt} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:site" content="@isALTEREGOout" />
	<meta name="twitter:image" content={ogImage} />
	<meta name="twitter:image:alt" content={ogImageAlt} />

	<meta
		name="theme-color"
		content="#33577a"
		media="(prefers-color-scheme: light)"
	/>
	<meta
		name="theme-color"
		content="#0c1220"
		media="(prefers-color-scheme: dark)"
	/>
	<meta name="apple-mobile-web-app-title" content="TDS:SE" />

	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon.ico" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

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
	{#if !isStandalone}
		{#if desktop.current}
			<div class="flex h-screen flex-col" in:fade={{ duration: 140 }}>
				<DesktopLayout {isClient} />
			</div>
		{:else}
			<div in:fade={{ duration: 140 }}>
				<MobileLayout {isClient} />
			</div>
		{/if}
	{/if}
</Tooltip.Provider>
<AnnouncementsModal />
<InboxModal />
<Toaster />
