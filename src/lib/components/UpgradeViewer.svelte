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
                                    {#if line.icon}
                                        <img
                                            src={line.icon}
                                            alt={line.stat}
                                            class={`inline-block w-[1em] h-[1em] shrink-0 ${
                                                isDetectionStat(line.stat)
                                                    ? "dark:invert-0 invert"
                                                    : ""
                                            }`}
                                        />
                                    {:else}
                                        <span class="upgrade-summary-bullet">●</span>
                                    {/if}

                                    {#if line.kind === "change"}
                                        <span>{line.stat}: {line.from} → {line.to}</span>
                                    {:else}
                                        <span>{line.stat}</span>
                                    {/if}
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
        gap: 0.25rem;
    }

    .upgrade-summary-line {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: var(--foreground);
    }

    .upgrade-summary-bullet {
        display: inline-block;
        width: 1em;
        text-align: center;
        flex-shrink: 0;
    }
</style>
