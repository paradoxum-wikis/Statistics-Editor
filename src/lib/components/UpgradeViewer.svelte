<script lang="ts">
    import { Tabs } from "bits-ui";
    import { fade } from "svelte/transition";

    type SummaryLine = {
        kind: "change" | "grant";
        stat: string;
        from?: string;
        to?: string;
        icon?: string;
    };

    let {
        upgradeImages,
        upgradeNames = {},
        upgradeSummaries = {},
        selectedUpgrade = $bindable("0"),
        numUpgrades,
        loadingImages,
    }: {
        upgradeImages: { [key: number]: string };
        upgradeNames?: { [key: number]: string };
        upgradeSummaries?: { [key: number]: SummaryLine[] };
        selectedUpgrade: string;
        numUpgrades: number;
        loadingImages: Map<number, boolean>;
    } = $props();

    function isDetectionStat(stat: string): boolean {
        return stat === "Hidden" || stat === "Flying" || stat === "Lead";
    }
</script>

<h2 class="upgrade-heading">Upgrades</h2>
<Tabs.Root bind:value={selectedUpgrade}>
    <Tabs.List class="upgrade-tabs-list">
        {#each Array(numUpgrades) as _, index}
            <Tabs.Trigger
                value={index.toString()}
                class="upgrade-tab-trigger"
            >
                {index + 1}
            </Tabs.Trigger>
        {/each}
    </Tabs.List>

    {#each Array(numUpgrades) as _, index}
        <Tabs.Content value={index.toString()}>
            <div in:fade={{ duration: 200 }}>
                {#if loadingImages.get(index)}
                    <div class="upgrade-image-container">
                        Loading...
                    </div>
                {:else if upgradeImages[index]}
                    <img
                        src={upgradeImages[index]}
                        alt={`Upgrade ${index + 1}`}
                        class="w-full aspect-square object-contain"
                    />
                {:else}
                    <div class="upgrade-image-container">
                        No image available
                    </div>
                {/if}

                {#if upgradeNames[index]}
                    <div class="upgrade-name">
                        {upgradeNames[index]}
                    </div>
                {/if}

                {#if upgradeSummaries[index]?.length}
                    <div class="upgrade-summary-box">
                        <div class="upgrade-summary-list">
                            {#each upgradeSummaries[index] as line}
                                <div class="upgrade-summary-line">
                                    <span class="upgrade-summary-marker">
                                        {#if line.icon}
                                            <img
                                                src={line.icon}
                                                alt={line.stat}
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
                                            {line.stat}: {line.from} → {line.to}
                                        {:else}
                                            {line.stat}
                                        {/if}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
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

    .upgrade-heading {
        @apply text-sm font-semibold mb-4 text-foreground;
    }

    :global(.upgrade-tabs-list) {
        @apply flex space-x-1 mb-4;
    }

    :global(.upgrade-tab-trigger) {
        border-radius: var(--radius) 0;
        @apply px-2 py-1 text-xs bg-muted w-full;
    }

    .upgrade-image-container {
        @apply w-full h-32 bg-muted rounded flex items-center justify-center text-muted-foreground;
    }

    .upgrade-name {
        @apply mt-2 text-center text-sm font-medium;
    }
</style>
