<script lang="ts">
  import { towerStore } from "$lib/stores/tower.svelte";
  import { getTargetSkins } from "$lib/utils/towah";
  import HiddenIcon from "$lib/assets/HiddenDetection.png?enhanced";
  import LeadIcon from "$lib/assets/LeadDetection.png?enhanced";
  import FlyingIcon from "$lib/assets/FlyingDetection.png?enhanced";
  import { Select } from "bits-ui";
  import { Check, ChevronDown, ScanEye } from "@lucide/svelte";
  import CollapsibleSide from "./smol/CollapsibleSide.svelte";
  import SubtleRow from "./smol/SubtleRow.svelte";
  import Tip from "./smol/Tip.svelte";
  import { stripRefs } from "$lib/utils/format";
  import { mkCellKey } from "$lib/neowtext/directives";
  import {
    DETECTION_TYPES,
    type DetectionType,
    levelsOnBranch,
    schemaBranches,
    getFncValue,
  } from "$lib/neowtext/functions";
  import type SkinData from "$lib/towerComponents/skinData";

  let open = $state(true);
  let skinData = $derived(
    towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
  );

  const detectionMeta = [
    { type: "Hidden" as const, icon: HiddenIcon },
    { type: "Lead" as const, icon: LeadIcon },
    { type: "Flying" as const, icon: FlyingIcon },
  ];

  type BranchCol = { letter: string; label: string };

  let branchCols = $derived.by((): BranchCol[] => {
    towerStore.refreshTrigger;
    if (!skinData) return [{ letter: "N", label: "" }];

    const schema = skinData.getSchema();
    const letters = schemaBranches(schema);
    if (letters.length <= 1) return [{ letter: letters[0] || "N", label: "" }];

    const names = (getFncValue(skinData.formulaTokens, "BRANCH") || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    return letters.map((letter, i) => {
      if (i === 0) return { letter, label: "Base" };
      const raw = names[i - 1] || letter;
      return {
        letter,
        label: raw.replace(/\s*Stats\s*$/i, "").trim() || letter,
      };
    });
  });

  let multiPath = $derived(branchCols.length > 1);
  let trunkLetter = $derived(branchCols[0]?.letter || "N");

  function levelOptionsFor(
    skin: SkinData,
    branch: string,
    type: DetectionType,
  ): { value: string; label: string }[] {
    const schema = skin.getSchema();
    const slotCount = schema?.length ?? 1 + skin.upgrades.length;
    const levels = levelsOnBranch(schema, branch, slotCount);

    // none inherits base
    let noneLabel = "∅";
    if (multiPath && branch !== trunkLetter) {
      const baseLvl = skin.getEffectiveDetectionStart(type, trunkLetter);
      if (baseLvl !== null) noneLabel = `Lvl. ${baseLvl}`;
    }

    return [
      { value: "none", label: noneLabel },
      ...levels.map((lvl) => ({
        value: String(lvl),
        label: `Lvl. ${lvl}`,
      })),
    ];
  }

  let selectedGains = $derived.by(() => {
    towerStore.refreshTrigger;
    const empty = Object.fromEntries(
      DETECTION_TYPES.map((t) => [t, {} as Record<string, string>]),
    ) as Record<DetectionType, Record<string, string>>;
    if (!skinData) return empty;

    const gains = skinData.getDetectionGains();
    for (const type of DETECTION_TYPES) {
      empty[type] = {};
      for (const col of branchCols) {
        const v = gains[col.letter]?.[type];
        empty[type][col.letter] =
          v !== undefined && v !== null ? String(v) : "none";
      }
    }
    return empty;
  });

  function captureDetectionBaselines(skin: SkinData) {
    const headers =
      skin.headers.length > 0 ? skin.headers : skin.levels.attributes;
    for (const type of DETECTION_TYPES) {
      const header = headers.find((h) => stripRefs(h) === type);
      if (!header) continue;
      for (let i = 0; i < skin.levels.levels.length; i++) {
        towerStore.captureBaselineCell(
          mkCellKey(skin.name, 0, i, header),
          skin.levels.getCell(i, header),
        );
      }
    }
  }

  function updateDetectionStart(
    type: DetectionType,
    branch: string,
    startLevel: number | null,
  ) {
    const tower = towerStore.selectedData;
    if (!tower) return;

    const currentSkin = tower.getSkin(towerStore.selectedSkinName);
    if (!currentSkin) return;

    for (const skin of getTargetSkins(tower, currentSkin)) {
      captureDetectionBaselines(skin);
      skin.setDetectionStart(type, branch, startLevel, false);
      skin.createData();
    }

    towerStore.markDirty();
  }
</script>

{#snippet levelSelect(
  type: DetectionType,
  letter: string,
  options: { value: string; label: string }[],
  value: string,
)}
  <Select.Root
    type="single"
    items={options}
    {value}
    onValueChange={(val) =>
      updateDetectionStart(
        type,
        letter,
        val === "none" ? null : parseInt(val, 10),
      )}
  >
    <Select.Trigger class="select-trigger w-22.5 shrink-0">
      <span class="truncate">
        {options.find((o) => o.value === value)?.label}
      </span>
      <ChevronDown class="w-3 h-3 opacity-50 ms-1" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content class="select-content min-w-27 max-h-55" sideOffset={5}>
        <Select.Viewport class="p-1">
          {#each options as option (option.value)}
            <Select.Item
              class="select-item"
              value={option.value}
              label={option.label}
            >
              {#snippet children({ selected })}
                {option.label}
                {#if selected}
                  <div class="ms-auto">
                    <Check class="w-3 h-3" />
                  </div>
                {/if}
              {/snippet}
            </Select.Item>
          {/each}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
{/snippet}

<CollapsibleSide
  title="Detections"
  icon={ScanEye}
  bind:open
  isPvp={skinData?.isPvp ?? false}
>
  {#if skinData}
    <div class="grid gap-2">
      {#each detectionMeta as detection (detection.type)}
        {#if multiPath}
          <SubtleRow class="overflow-hidden">
            <div
              class="flex items-center gap-1 px-3.5 py-1 border-b border-border bg-secondary/30"
            >
              <enhanced:img
                src={detection.icon}
                alt="{detection.type} Detection"
                class="w-4 h-4 dark:invert-0 invert"
              />
              <span class="text-xs font-medium">{detection.type}</span>
            </div>
            <div class="grid gap-1 p-1.5">
              {#each branchCols as col (col.letter)}
                {@const options = levelOptionsFor(
                  skinData,
                  col.letter,
                  detection.type,
                )}
                {@const value =
                  selectedGains[detection.type][col.letter] ?? "none"}
                <div class="flex items-center justify-between gap-2 px-1">
                  <Tip content={col.label}>
                    {#snippet children({ props })}
                      <span
                        {...props}
                        class="min-w-0 truncate text-[0.7rem] text-muted-foreground"
                      >
                        {col.label}
                      </span>
                    {/snippet}
                  </Tip>
                  {@render levelSelect(
                    detection.type,
                    col.letter,
                    options,
                    value,
                  )}
                </div>
              {/each}
            </div>
          </SubtleRow>
        {:else}
          {@const col = branchCols[0]}
          {@const options = levelOptionsFor(
            skinData,
            col.letter,
            detection.type,
          )}
          {@const value = selectedGains[detection.type][col.letter] ?? "none"}
          <SubtleRow class="flex items-center justify-between p-1">
            <div class="flex items-center gap-1.5 px-1">
              <enhanced:img
                src={detection.icon}
                alt="{detection.type} Detection"
                class="w-5 h-5 dark:invert-0 invert"
              />
              <span class="text-xs font-medium">{detection.type}</span>
            </div>
            {@render levelSelect(detection.type, col.letter, options, value)}
          </SubtleRow>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="text-xs text-muted-foreground px-1">
      Select a tower to edit detections.
    </p>
  {/if}
</CollapsibleSide>
