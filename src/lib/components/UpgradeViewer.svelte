<script lang="ts">
  import { Tabs } from "bits-ui";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import WikiBanner from "./smol/WikiBanner.svelte";
  import Separator from "./smol/Separator.svelte";
  import { stripRefs } from "$lib/utils/format";
  import { renderCellHtml } from "$lib/neowtext/render";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { imageLoader } from "$lib/services/imageLoader";
  import { settingsStore } from "$lib/stores/settings.svelte";

  let {
    upgradeNames = {},
    upgradeSummaries = {},
    upgradeLevels = [],
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
        icon?: string;
      }>;
    };
    upgradeLevels?: string[];
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

<WikiBanner />
<Separator class="mb-4" />

<Tabs.Root bind:value={selectedUpgrade}>
  <Tabs.List class="mb-4 flex space-x-1 overflow-x-auto">
    {#each Array(numUpgrades) as _, index (index)}
      <Tabs.Trigger
        value={index.toString()}
        class="w-full rounded-[var(--radius)_0] bg-muted px-2 py-1 text-xs transition-[background-color,color] duration-250 data-[state=active]:cursor-default data-[state=active]:bg-primary data-[state=active]:text-white"
      >
        {upgradeLevels[index] ?? index + 1}
      </Tabs.Trigger>
    {/each}
  </Tabs.List>

  {#each Array(numUpgrades) as _, index (index)}
    <Tabs.Content value={index.toString()}>
      {#if selectedUpgrade === index.toString()}
        <div in:fade={{ duration: 250, easing: cubicOut }}>
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
            <div class="upgrade-summary-box">
              <div class="upgrade-summary-list">
                {#each upgradeSummaries[index] as line, i (i)}
                  <div class="upgrade-summary-line">
                    <span class="upgrade-summary-marker">
                      {#if line.icon}
                        <img
                          src={line.icon}
                          alt={stripRefs(line.stat)}
                          class={isDetectionStat(line.stat)
                            ? "dark:invert-0 invert"
                            : ""}
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
  @reference "../../routes/layout.css";

  .upgrade-summary-box {
    margin-top: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius) 0;
    background: var(--secondary);
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

  .upgrade-summary-marker > img {
    width: 1em;
    height: 1em;
    display: block;
    margin-top: 0.05em;
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
    @apply w-full aspect-square bg-muted rounded flex items-center justify-center text-muted-foreground;
  }

  .upgrade-name {
    @apply mt-2 text-center text-sm font-medium;
  }

  .upgrade-bg {
    background-image: repeating-conic-gradient(
      var(--upgrade-bg-1) 0 25%,
      var(--upgrade-bg-2) 0 50%
    );
    background-size: 1.9em 1.9em;
    @apply w-full aspect-square object-contain;
  }
</style>
