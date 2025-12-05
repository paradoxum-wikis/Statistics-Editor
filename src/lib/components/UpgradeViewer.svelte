<script lang="ts">
    import { Tabs } from "bits-ui";

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

<h2 class="text-sm font-semibold mb-4 text-foreground">Upgrades</h2>
<Tabs.Root bind:value={selectedUpgrade}>
    <Tabs.List class="flex space-x-1 mb-4">
        {#each Array(numUpgrades) as _, index}
            <Tabs.Trigger
                value={index.toString()}
                class="px-2 py-1 text-xs bg-muted rounded"
            >
                {index + 1}
            </Tabs.Trigger>
        {/each}
    </Tabs.List>
    {#each Array(numUpgrades) as _, index}
        <Tabs.Content value={index.toString()}>
            {#if loadingImages.get(index)}
                <div
                    class="w-full h-32 bg-muted rounded flex items-center justify-center text-muted-foreground"
                >
                    Loading...
                </div>
            {:else if upgradeImages[index]}
                <img
                    src={upgradeImages[index]}
                    alt={`Upgrade ${index + 1}`}
                    class="w-full rounded"
                />
            {:else}
                <div
                    class="w-full h-32 bg-muted rounded flex items-center justify-center text-muted-foreground"
                >
                    No image available
                </div>
            {/if}
            {#if upgradeNames[index]}
                <div class="mt-2 text-center text-sm font-medium">
                    {upgradeNames[index]}
                </div>
            {/if}
        </Tabs.Content>
    {/each}
</Tabs.Root>
