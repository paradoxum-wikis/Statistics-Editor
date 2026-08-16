<script lang="ts">
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import { Tabs } from "bits-ui";
	import type { Picture } from "@sveltejs/enhanced-img";
	import { stripRefs } from "$lib/utils/format";
	import { renderCellHtml } from "$lib/neowtext/render";
	import { towerStore } from "$lib/stores/tower.svelte";
	import { imageLoader } from "$lib/services/imageLoader";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { tabPill } from "$lib/utils/tabPill.svelte";

	let {
		upgradeNames = {},
		upgradeSummaries = {},
		upgradeLevels = [],
		upgradeGroups = [],
		selectedUpgrade = $bindable("0"),
		numUpgrades,
	}: {
		upgradeNames?: { [key: number]: string };
		upgradeSummaries?: {
			[key: number]: Array<{
				kind: "change" | "grant";
				stat: string;
				from?: string | number | null;
				to?: string | number | null;
				icon?: Picture;
			}>;
		};
		upgradeLevels?: string[];
		upgradeGroups?: { branch: string; indices: number[] }[];
		selectedUpgrade: string;
		numUpgrades: number;
	} = $props();

	function isDetectionStat(stat: string): boolean {
		const cleanStat = stripRefs(stat);
		return (
			cleanStat === "Hidden" || cleanStat === "Flying" || cleanStat === "Lead"
		);
	}

	let selectedUpgradeIndex = $derived.by(() => {
		const i = parseInt(selectedUpgrade);
		return Number.isNaN(i) ? -1 : i;
	});

	let selectedImageContext = $derived.by(() => {
		towerStore.refreshTrigger;
		const tower = towerStore.selectedData;
		const index = selectedUpgradeIndex;
		if (!tower || index < 0) return null;

		const skin = tower.getSkin(towerStore.selectedSkinName);
		const imageId = skin?.upgrades?.[index]?.upgradeData?.Image;
		if (!imageId) return null;

		return { towerName: tower.name, index, imageId };
	});

	let selectedImageUrl = $state<string | null>(null);
	let selectedImageLoading = $state(false);
	let selectedImageFailed = $state(false);
	let upgradeDirection = $state(1);

	// Under a path header, strip the redundant letter (5A → 5 under A).
	function pathTabLabel(index: number, branch?: string): string {
		const raw = upgradeLevels[index] ?? String(index + 1);
		if (!branch || settingsStore.compactPathTabs) return raw;
		const match = raw.match(/^(\d+)([A-Za-z]+)$/);
		if (!match) return raw;
		if (match[2].toUpperCase() === branch.toUpperCase()) return match[1];
		return raw;
	}

	$effect(() => {
		imageLoader.setDebugMode(settingsStore.debugMode);
	});

	$effect(() => {
		const ctx = selectedImageContext;
		if (!ctx) {
			selectedImageUrl = null;
			selectedImageLoading = false;
			selectedImageFailed = false;
			return;
		}

		const { towerName, index, imageId } = ctx;
		const cached = imageLoader.getCachedUrl(towerName, index, imageId);
		if (cached) {
			selectedImageUrl = cached;
			selectedImageLoading = false;
			selectedImageFailed = false;
			return;
		}

		if (imageLoader.hasFailed(towerName, index, imageId)) {
			selectedImageUrl = null;
			selectedImageLoading = false;
			selectedImageFailed = true;
			return;
		}

		selectedImageUrl = null;
		selectedImageLoading = true;
		selectedImageFailed = false;

		let cancelled = false;

		imageLoader.loadImage(towerName, index, imageId).then((url) => {
			if (cancelled || towerStore.selectedData?.name !== towerName) return;
			selectedImageUrl = url;
			selectedImageLoading = false;
			selectedImageFailed = !url;
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<Tabs.Root
	value={selectedUpgrade}
	onValueChange={(value) => {
		upgradeDirection = Number(value) >= Number(selectedUpgrade) ? 1 : -1;
		selectedUpgrade = value;
	}}
>
	<Tabs.List class="contents">
		{#if upgradeGroups.length > 1}
			<div
				class="tabs-list stretch mb-1.5 overflow-x-auto"
				use:tabPill={() => selectedUpgrade}
			>
				{#each upgradeGroups[0].indices as index (index)}
					<Tabs.Trigger value={index.toString()} class="tabs-trigger">
						{pathTabLabel(index)}
					</Tabs.Trigger>
				{/each}
			</div>
			<div class="mb-4 flex gap-1.5">
				{#each upgradeGroups.slice(1) as group (group.branch)}
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						{#if !settingsStore.compactPathTabs}
							<span
								class="mx-auto text-[0.6rem] font-bold tracking-wider text-muted-foreground"
							>
								{group.branch}
							</span>
						{/if}
						<div
							class="tabs-list stretch overflow-x-auto"
							use:tabPill={() => selectedUpgrade}
						>
							{#each group.indices as index (index)}
								<Tabs.Trigger value={index.toString()} class="tabs-trigger">
									{pathTabLabel(index, group.branch)}
								</Tabs.Trigger>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div
				class="tabs-list stretch mb-4 overflow-x-auto"
				use:tabPill={() => selectedUpgrade}
			>
				{#each Array(numUpgrades) as _, index (index)}
					<Tabs.Trigger value={index.toString()} class="tabs-trigger">
						{pathTabLabel(index)}
					</Tabs.Trigger>
				{/each}
			</div>
		{/if}
	</Tabs.List>

	{#each Array(numUpgrades) as _, index (index)}
		<Tabs.Content value={index.toString()}>
			{#if selectedUpgrade === index.toString()}
				<div
					in:fly={{ x: upgradeDirection * 48, duration: 180, easing: cubicOut }}
				>
					{#if selectedImageLoading}
						<div class="upgrade-image-container">Loading...</div>
					{:else if selectedImageUrl}
						<img
							src={selectedImageUrl}
							alt={`Upgrade ${index + 1}`}
							class="upgrade-bg"
						/>
					{:else if selectedImageFailed}
						<div class="upgrade-image-container">Failed to load image</div>
					{:else}
						<div class="upgrade-image-container">No image available</div>
					{/if}

					{#if upgradeNames[index]}
						<div class="upgrade-name">
							{@html renderCellHtml(upgradeNames[index], true)}
						</div>
					{/if}

					{#if upgradeSummaries[index]?.length}
						<div class="upgrade-summary-box mt-2 mb-1">
							<div class="upgrade-summary-list">
								{#each upgradeSummaries[index] as line, i (i)}
									<div class="upgrade-summary-line">
										<span class="upgrade-summary-marker">
											{#if line.icon}
												<enhanced:img
													src={line.icon}
													alt={stripRefs(line.stat)}
													class="mt-[0.05em] block size-[1em] {isDetectionStat(
														line.stat,
													)
														? 'dark:invert-0 invert'
														: ''}"
												/>
											{:else}
												<span class="upgrade-summary-bullet">●</span>
											{/if}
										</span>

										<span class="upgrade-summary-text">
											{#if line.kind === "change"}
												{@html renderCellHtml(line.stat, true)}: {@html renderCellHtml(
													line.from,
													false,
												)} → {@html renderCellHtml(line.to, false)}
											{:else}
												{@html renderCellHtml(line.stat, true)}
											{/if}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</Tabs.Content>
	{/each}
</Tabs.Root>

<style>
	.upgrade-summary-box {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--muted);
		padding: 0.5rem 0.625rem;
		font-size: 0.85em;
	}

	.upgrade-summary-list {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
	}

	.upgrade-summary-line {
		display: flex;
		align-items: flex-start;
		gap: 0.375em;
		color: var(--foreground);
	}

	.upgrade-summary-marker {
		width: 1em;
		flex: 0 0 1em;
		display: inline-flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 0.1em;
	}

	.upgrade-summary-bullet {
		display: block;
		line-height: 1;
	}

	.upgrade-summary-text {
		flex: 1 1 auto;
		min-width: 0;
		line-height: 1.25;
		text-wrap: balance;
	}

	.upgrade-image-container {
		width: 100%;
		aspect-ratio: 1;
		background: var(--secondary);
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted-foreground);
	}

	.upgrade-name {
		margin-top: 0.5rem;
		text-align: center;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.upgrade-bg {
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
		background-image: repeating-conic-gradient(
			var(--upgrade-bg-1) 0 25%,
			var(--upgrade-bg-2) 0 50%
		);
		background-size: 1.9em 1.9em;
	}
</style>
