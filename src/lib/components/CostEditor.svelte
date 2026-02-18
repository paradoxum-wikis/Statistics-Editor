<script lang="ts">
    import { towerStore } from "$lib/stores/tower.svelte";
    import Separator from "./Separator.svelte";
    import { CircleDollarSign } from "@lucide/svelte";

    type CostRow = { level: number; cost: number };

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
            const num = Number(String(costStr).replace(/,/g, ""));
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

        if (currentSkin.isPvp) {
            currentSkin.setCost(level, value);
        } else {
            for (const skinName of tower.skinNames) {
                const skin = tower.getSkin(skinName);
                if (!skin || skin.isPvp) continue;
                skin.setCost(level, value);
            }
        }

        towerStore.save();
        towerStore.refresh();
    }
</script>

<div class="space-y-3 mt-4">
    <Separator />
    <h3 class="text-sm font-semibold text-foreground px-1">
        <CircleDollarSign class="inline w-3.5 h-3.5 mb-0.5 opacity-70" />
        Costs
        {#if skinData?.isPvp}
            <span class="text-xs font-normal text-muted-foreground ml-1">(PVP)</span>
        {/if}
    </h3>

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

<style>
    @reference "../../routes/layout.css";

    .cost-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.4rem;
        border-radius: calc(var(--radius) - 0.25rem) 0;
        border: 1px solid var(--border);
        @apply bg-secondary/10;
    }

    .level-label {
        font-size: 0.7rem;
        color: var(--muted-foreground);
        width: 3rem;
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
