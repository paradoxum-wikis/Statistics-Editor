<script lang="ts">
  import { towerStore } from "$lib/stores/tower.svelte";
  import { getTargetSkins } from "$lib/utils/towah";
  import CollapsibleSide from "./smol/CollapsibleSide.svelte";
  import SubtleRow from "./smol/SubtleRow.svelte";
  import Tip from "./smol/Tip.svelte";
  import { CircleDollarSign } from "@lucide/svelte";
  import { parseNumeric, stripRefs } from "$lib/utils/format";
  import { getEffectiveFncKey, getFncValue } from "$lib/neowtext/functions";
  import { mkCellKey } from "$lib/neowtext/directives";
  import type SkinData from "$lib/towerComponents/skinData";

  type CostRow = {
    level: number;
    label: string;
    cost: number;
  };

  let open = $state(true);
  let skinData = $derived(
    towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
  );

  function costKeyFor(skin: SkinData): string {
    return skin.isPvp &&
      getFncValue(skin.formulaTokens, "PVP-COST") !== undefined
      ? getEffectiveFncKey(skin.formulaTokens, "PVP-COST")
      : getEffectiveFncKey(skin.formulaTokens, "COST", skin.variantPrefix);
  }

  function costAt(skin: SkinData, level: number): number {
    const num = parseNumeric(
      (skin.formulaTokens[costKeyFor(skin)] || "").split(";")[level]?.trim() ||
        "0",
    );
    return Number.isNaN(num) ? 0 : num;
  }

  let costRows = $derived.by((): CostRow[] => {
    towerStore.refreshTrigger;
    if (!skinData?.formulaTokens) return [];

    const levels = skinData.levels?.levels ?? [];
    const upgrades = skinData.upgrades ?? [];
    const rows: CostRow[] = [];

    for (let i = 0; i < levels.length; i++) {
      const label =
        i === 0
          ? "Base"
          : String(
              upgrades[i - 1]?.upgradeData?.Level != null
                ? upgrades[i - 1].upgradeData.Level
                : i,
            );
      rows.push({ level: i, label, cost: costAt(skinData, i) });
    }

    return rows;
  });

  function updateCost(level: number, value: number) {
    const tower = towerStore.selectedData;
    if (!tower) return;
    const currentSkin = tower.getSkin(towerStore.selectedSkinName);
    if (!currentSkin) return;

    for (const skin of getTargetSkins(tower, currentSkin)) {
      const headers =
        skin.headers.length > 0 ? skin.headers : skin.levels.attributes;
      const costHeader = headers.find((h) => stripRefs(h) === "Cost");
      if (costHeader) {
        towerStore.captureBaselineCell(
          mkCellKey(skin.name, 0, level, costHeader),
          costAt(skin, level),
        );
      }
      const totalHeader = headers.find((h) => stripRefs(h) === "Total Price");
      if (totalHeader) {
        for (let i = level; i < skin.levels.levels.length; i++) {
          towerStore.captureBaselineCell(
            mkCellKey(skin.name, 0, i, totalHeader),
            skin.levels.getCell(i, totalHeader),
          );
        }
      }
      skin.setCost(level, value);
    }

    towerStore.markDirty();
  }
</script>

<CollapsibleSide
  title="Costs"
  icon={CircleDollarSign}
  bind:open
  isPvp={skinData?.isPvp ?? false}
>
  {#if costRows.length > 0}
    <div class="grid gap-1.5">
      {#each costRows as row (row.level)}
        <SubtleRow class="flex items-center px-1.5 py-1">
          <Tip content={row.level === 0 ? "Base" : `Slot ${row.level}`}>
            {#snippet children({ props })}
              <span
                class="text-[0.7rem] text-muted-foreground min-w-13 max-w-20 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
                {...props}
              >
                {row.level === 0 ? row.label : `Upg. ${row.label}`}
              </span>
            {/snippet}
          </Tip>
          <input
            type="number"
            class="input input-compact"
            value={row.cost}
            min="0"
            step="1"
            onchange={(e) => {
              const val = parseInt(e.currentTarget.value);
              if (!isNaN(val) && val >= 0) updateCost(row.level, val);
            }}
          />
        </SubtleRow>
      {/each}
    </div>
  {:else if skinData}
    <p class="text-xs text-muted-foreground px-1">No cost variables defined.</p>
  {:else}
    <p class="text-xs text-muted-foreground px-1">
      Select a tower to edit costs.
    </p>
  {/if}
</CollapsibleSide>
