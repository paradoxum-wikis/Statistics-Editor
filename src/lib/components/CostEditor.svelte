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
        <div class="subtle-row-surface flex items-center px-1.5 py-1">
          <span
            class="text-[0.7rem] text-muted-foreground min-w-13 max-w-20 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
            title={row.level === 0 ? "Base" : `Slot ${row.level}`}
          >
            {row.level === 0 ? row.label : `Upg. ${row.label}`}
          </span>
          <input
            type="number"
            class="flex-1 text-[0.7rem] bg-background border border-input [border-radius:calc(var(--radius)-0.5rem)_0] px-1.5 py-0.5 text-right text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
