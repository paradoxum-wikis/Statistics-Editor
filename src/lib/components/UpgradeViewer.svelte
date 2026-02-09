<script lang="ts">
    import { Tabs } from "bits-ui";
    import { fade } from "svelte/transition";

    let {
        upgradeImages,
        upgradeNames = {},
        selectedUpgrade = $bindable("0"),
        numUpgrades,
        loadingImages,
    }: {
        upgradeImages: { [key: number]: string };
        upgradeNames?: { [key: number]: string };
        selectedUpgrade: string;
        numUpgrades: number;
        loadingImages: Map<number, boolean>;
    } = $props();
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
                        class="upgrade-image"
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
            </div>
        </Tabs.Content>
    {/each}
</Tabs.Root>
