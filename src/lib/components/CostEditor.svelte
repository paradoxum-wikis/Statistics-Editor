<script lang="ts">
    import { towerStore } from "$lib/stores/tower.svelte";
    import { getTargetSkins } from "$lib/utils/towah";
    import { Collapsible } from "bits-ui";
    import Separator from "./Separator.svelte";
    import { CircleDollarSign, ChevronDown } from "@lucide/svelte";
    import { slide } from "svelte/transition";
    import { parseNumeric } from "$lib/utils/format";

    type CostRow = { level: number; cost: number };

    let open = $state(false);
    let skinData = $derived(
        towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
    );

    let costRows = $derived.by((): CostRow[] => {
        towerStore.effectiveWikitext;
        if (!skinData?.formulaTokens) return [];
        const levels = skinData.levels?.levels ?? [];
        const rows: CostRow[] = [];
        for (let i = 0; i < levels.length; i++) {
            const costKey = `$${i}Cost$`;
            const costStr = skinData.formulaTokens[costKey];
            if (costStr === undefined) return [];
            const num = parseNumeric(costStr);
            if (isNaN(num)) return [];
            rows.push({ level: i, cost: num });
        }
        return rows;
    });

    function updateCost(level: number, value: number) {
        const tower = towerStore.selectedData;
        if (!tower) return;
        const currentSkin = tower.getSkin(towerStore.selectedSkinName);
        if (!currentSkin) return;

        for (const skin of getTargetSkins(tower, currentSkin)) {
            skin.setCost(level, value);
        }

        towerStore.save();
        towerStore.refresh();
    }
</script>

<div class="mt-4">
    <Separator />
    <Collapsible.Root bind:open>
        <Collapsible.Trigger class="section-trigger">
            <span class="section-title">
                <CircleDollarSign class="inline w-3.5 h-3.5 mb-0.5 opacity-70" />
                Costs
                {#if skinData?.isPvp}
                    <span class="text-xs font-normal text-muted-foreground ml-1">(PVP)</span>
                {/if}
            </span>
            <ChevronDown class="chevron-icon" style="transform: rotate({open ? '180deg' : '0deg'})" />
        </Collapsible.Trigger>
        <Collapsible.Content forceMount>
            {#snippet child({ open: isOpen })}
                {#if isOpen}
                    <div class="pb-2" transition:slide={{ duration: 150 }}>
                        {#if costRows.length > 0}
                            <div class="grid gap-1.5">
                                {#each costRows as row (row.level)}
                                    <div class="cost-row">
                                        <span class="level-label">
                                            {row.level === 0 ? "Base" : `Upg. ${row.level}`}
                                        </span>
                                        <input
                                            type="number"
                                            class="cost-input"
                                            value={row.cost}
                                            min="0"
                                            step="1"
                                            onchange={(e) => {
                                                const val = parseInt(e.currentTarget.value);
                                                if (!isNaN(val) && val >= 0) updateCost(row.level, val);
                                            }}
                                        />
                                    </div>
                                {/each}
                            </div>
                        {:else if skinData}
                            <p class="text-xs text-muted-foreground px-1">No cost variables defined.</p>
                        {:else}
                            <p class="text-xs text-muted-foreground px-1">Select a tower to edit costs.</p>
                        {/if}
                    </div>
                {/if}
            {/snippet}
        </Collapsible.Content>
    </Collapsible.Root>
</div>

<style>
    @reference "../../routes/layout.css";

    .cost-row {
        display: flex;
        align-items: center;
        padding: 0.25rem 0.4rem;
        border-radius: calc(var(--radius) - 0.25rem) 0;
        border: 1px solid var(--border);
        @apply bg-secondary/10;
    }

    .level-label {
        font-size: 0.7rem;
        color: var(--muted-foreground);
        width: 2.75rem;
        flex-shrink: 0;
    }

    .cost-input {
        flex: 1;
        font-size: 0.7rem;
        background: var(--background);
        border: 1px solid var(--input);
        border-radius: calc(var(--radius) - 0.5rem) 0;
        padding: 0.1rem 0.375rem;
        text-align: right;
        color: var(--foreground);
        outline: none;

        &:focus {
            box-shadow: 0 0 0 2px var(--ring);
        }

        &::-webkit-outer-spin-button,
        &::-webkit-inner-spin-button {
            -webkit-appearance: none;
        }

        -moz-appearance: textfield;
    }
</style>
