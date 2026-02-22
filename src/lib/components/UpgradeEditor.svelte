<script lang="ts">
    import { towerStore } from "$lib/stores/tower.svelte";
    import { imageLoader } from "$lib/services/imageLoader";
    import { getTargetSkins } from "$lib/utils/towah";
    import CollapsibleSection from "./smol/CollapsibleSection.svelte";
    import { Layers } from "@lucide/svelte";

    type UpgradeRow = { index: number; title: string; image: string };

    let open = $state(false);
    let skinData = $derived(
        towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
    );

    let upgradeRows = $derived.by((): UpgradeRow[] => {
        towerStore.effectiveWikitext;
        if (!skinData?.upgrades?.length) return [];
        return skinData.upgrades.map((upgrade: any, index: number) => ({
            index,
            title: upgrade.upgradeData?.Title ?? "",
            image: upgrade.upgradeData?.Image ?? "",
        }));
    });

    function updateTitle(index: number, value: string) {
        const tower = towerStore.selectedData;
        if (!tower) return;
        const currentSkin = tower.getSkin(towerStore.selectedSkinName);
        if (!currentSkin) return;

        for (const skin of getTargetSkins(tower, currentSkin)) {
            skin.upgrades[index].upgradeData.Title = value;
        }

        towerStore.save();
        towerStore.refresh();
    }

    function updateImage(index: number, value: string) {
        const tower = towerStore.selectedData;
        if (!tower) return;
        const currentSkin = tower.getSkin(towerStore.selectedSkinName);
        if (!currentSkin) return;

        for (const skin of getTargetSkins(tower, currentSkin)) {
            skin.upgrades[index].upgradeData.Image = value;
        }

        imageLoader.clearUpgradeImageCache(tower.name, index);
        towerStore.save();
        towerStore.refresh();
    }
</script>

<CollapsibleSection title="Upgrades" icon={Layers} bind:open isPvp={skinData?.isPvp ?? false}>
    {#if upgradeRows.length > 0}
        <div class="grid gap-2">
            {#each upgradeRows as row (row.index)}
                <div class="upgrade-card">
                    <div class="upgrade-card-header">
                        Upgrade {row.index + 1}
                    </div>
                    <div class="upgrade-card-body">
                        <div class="field-row">
                            <span class="field-label">Title</span>
                            <input
                                type="text"
                                class="field-input"
                                placeholder="—"
                                value={row.title}
                                onchange={(e) => updateTitle(row.index, e.currentTarget.value)}
                            />
                        </div>
                        <div class="field-row">
                            <span class="field-label">Image</span>
                            <input
                                type="text"
                                class="field-input"
                                placeholder="—"
                                value={row.image}
                                onchange={(e) => updateImage(row.index, e.currentTarget.value)}
                            />
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else if skinData}
        <p class="text-xs text-muted-foreground px-1">No upgrades defined.</p>
    {:else}
        <p class="text-xs text-muted-foreground px-1">Select a tower to edit upgrades.</p>
    {/if}
</CollapsibleSection>

<style>
    @reference "../../routes/layout.css";

    .upgrade-card {
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 0.25rem) 0;
        overflow: hidden;
    }

    .upgrade-card-header {
        font-size: 0.68rem;
        font-weight: 600;
        color: var(--muted-foreground);
        padding: 0.15rem 0.85rem;
        border-bottom: 1px solid var(--border);
        @apply bg-secondary/30;
    }

    .upgrade-card-body {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.3rem 0.4rem;
        @apply bg-secondary/10;
    }

    .field-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .field-label {
        font-size: 0.65rem;
        color: var(--muted-foreground);
        width: 2.5rem;
        flex-shrink: 0;
    }

    .field-input {
        flex: 1;
        font-size: 0.7rem;
        background: var(--background);
        border: 1px solid var(--input);
        border-radius: calc(var(--radius) - 0.5rem) 0;
        padding: 0.1rem 0.375rem;
        color: var(--foreground);
        outline: none;
        min-width: 0;

        &::placeholder {
            color: var(--muted-foreground);
            opacity: 0.4;
        }
    }
</style>
