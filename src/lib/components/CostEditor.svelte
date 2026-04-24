<script lang="ts">
  import { towerStore } from "$lib/stores/tower.svelte";
  import { getTargetSkins } from "$lib/utils/towah";
  import CollapsibleSection from "./smol/CollapsibleSection.svelte";
  import { CircleDollarSign } from "@lucide/svelte";
  import { parseNumeric } from "$lib/utils/format";

  type CostRow = {
    level: number;
    label: string;
    cost: number;
  };

  let open = $state(true);
  let skinData = $derived(
    towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
  );

  let costRows = $derived.by((): CostRow[] => {
    towerStore.effectiveWikitext;
    if (!skinData?.formulaTokens) return [];

    const levels = skinData.levels?.levels ?? [];
    const upgrades = skinData.upgrades ?? [];
    const rows: CostRow[] = [];

    const costKey =
      skinData.isPvp && skinData.formulaTokens["$FNC-PVP-COST$"] !== undefined
        ? "$FNC-PVP-COST$"
        : "$FNC-COST$";

    const costArr = (skinData.formulaTokens[costKey] || "")
      .split(";")
      .map((s) => s.trim());

    for (let i = 0; i < levels.length; i++) {
      const costStr = costArr[i];
      const num = parseNumeric(costStr || "0");
      const label =
        i === 0
          ? "Base"
          : String(
              upgrades[i - 1]?.upgradeData?.Level != null
                ? upgrades[i - 1].upgradeData.Level
                : i,
            );
      rows.push({ level: i, label, cost: isNaN(num) ? 0 : num });
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

    towerStore.refresh();
    towerStore.syncWikitext();
  }
</script>

<CollapsibleSection
  title="Costs"
  icon={CircleDollarSign}
  bind:open
  isPvp={skinData?.isPvp ?? false}
>
  {#if costRows.length > 0}
    <div class="grid gap-1.5">
      {#each costRows as row (row.level)}
        <div class="cost-row">
          <span
            class="level-label"
            title={row.level === 0 ? "Base" : `Slot ${row.level}`}
          >
            {row.level === 0 ? row.label : `Upg. ${row.label}`}
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
    <p class="text-xs text-muted-foreground px-1">
      Select a tower to edit costs.
    </p>
  {/if}
</CollapsibleSection>

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
    min-width: 3.25rem;
    max-width: 5rem;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }

    -moz-appearance: textfield;
  }
</style>
