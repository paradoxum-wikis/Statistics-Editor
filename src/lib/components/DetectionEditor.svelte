<script lang="ts">
  import { towerStore } from "$lib/stores/tower.svelte";
  import { getTargetSkins } from "$lib/utils/towah";
  import HiddenIcon from "$lib/assets/HiddenDetection.png";
  import LeadIcon from "$lib/assets/LeadDetection.png";
  import FlyingIcon from "$lib/assets/FlyingDetection.png";
  import { Select } from "bits-ui";
  import { Check, ChevronDown, ScanEye } from "@lucide/svelte";
  import CollapsibleSide from "./smol/CollapsibleSide.svelte";
  import SubtleRow from "./smol/SubtleRow.svelte";

  let open = $state(true);
  let skinData = $derived(
    towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
  );

  let levels = $derived.by(() => {
    towerStore.refreshTrigger;
    return skinData?.levels.levels ?? [];
  });

  let levelOptions = $derived.by(() => {
    towerStore.refreshTrigger;
    return [
      { value: "none", label: "∅" },
      ...levels.map((_, i) => {
        const upg = skinData?.upgrades[i - 1];
        const displayLvl =
          i === 0 ? "0" : (upg?.upgradeData?.Level ?? i.toString());
        return { value: i.toString(), label: `Lvl. ${displayLvl}` };
      }),
    ];
  });

  const detectionTypes = [
    { type: "Hidden" as const, icon: HiddenIcon },
    { type: "Lead" as const, icon: LeadIcon },
    { type: "Flying" as const, icon: FlyingIcon },
  ];

  let selectedDetectionStart = $derived.by(() => {
    towerStore.refreshTrigger;
    return {
      Hidden: getDetectionStartLevel("Hidden")?.toString() ?? "none",
      Lead: getDetectionStartLevel("Lead")?.toString() ?? "none",
      Flying: getDetectionStartLevel("Flying")?.toString() ?? "none",
    };
  });

  function getDetectionStartLevel(
    type: "Hidden" | "Lead" | "Flying",
  ): number | null {
    if (!levels.length) return null;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i][type]) return i;
    }
    return null;
  }

  function updateDetectionStart(
    type: "Hidden" | "Lead" | "Flying",
    startLevel: number | null,
  ) {
    const tower = towerStore.selectedData;
    if (!tower) return;

    const currentSkin = tower.getSkin(towerStore.selectedSkinName);
    if (!currentSkin) return;

    for (const skin of getTargetSkins(tower, currentSkin)) {
      const totalLevels = skin.levels.levels.length;
      for (let i = 0; i < totalLevels; i++) {
        const shouldHave = startLevel !== null && i >= startLevel;
        skin.setDetection(i, type, shouldHave, false);
      }
      skin.createData();
    }

    towerStore.markDirty();
  }
</script>

<CollapsibleSide
  title="Detections"
  icon={ScanEye}
  bind:open
  isPvp={skinData?.isPvp ?? false}
>
  {#if skinData}
    <div class="grid gap-2">
      {#each detectionTypes as detection (detection.type)}
        <SubtleRow class="flex items-center justify-between p-1">
          <div class="flex items-center gap-1.5 px-1">
            <img
              src={detection.icon}
              alt="{detection.type} Detection"
              class="w-5 h-5 dark:invert-0 invert"
            />
            <span class="text-xs font-medium">{detection.type}</span>
          </div>

          <Select.Root
            type="single"
            items={levelOptions}
            value={selectedDetectionStart[detection.type]}
            onValueChange={(val) =>
              updateDetectionStart(
                detection.type,
                val === "none" ? null : parseInt(val),
              )}
          >
            <Select.Trigger class="select-trigger w-22.5">
              <span class="truncate">
                {levelOptions.find(
                  (o) => o.value === selectedDetectionStart[detection.type],
                )?.label}
              </span>
              <ChevronDown class="w-3 h-3 opacity-50 ms-1" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                class="select-content min-w-27 max-h-55"
                sideOffset={5}
              >
                <Select.Viewport class="p-1">
                  {#each levelOptions as option (option.value)}
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
        </SubtleRow>
      {/each}
    </div>
  {:else}
    <p class="text-xs text-muted-foreground px-1">
      Select a tower to edit detections.
    </p>
  {/if}
</CollapsibleSide>

<style>
  :global(.select-trigger) {
    display: inline-flex;
    height: 1.75rem;
    align-items: center;
    justify-content: space-between;
    border-radius: var(--radius) 0;
    border: 1px solid var(--input);
    background: var(--background);
    padding: 0 1rem;
    font-size: 0.875rem;
    transition:
      color 0.25s,
      background-color 0.25s,
      border-color 0.25s;
    outline: none;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &[data-placeholder] {
      color: var(--muted-foreground);
    }
  }

  :global(.select-content) {
    z-index: 17;
    overflow: hidden;
    border-radius: var(--radius) 0;
    border: 1px solid var(--border);
    background: var(--popover);
    color: var(--popover-foreground);

    &[data-state="open"] {
      animation: overlay-in 150ms ease;
    }

    &[data-state="closed"] {
      animation: overlay-out 100ms ease;
    }
  }

  :global(.select-item) {
    position: relative;
    display: flex;
    width: 100%;
    user-select: none;
    align-items: center;
    border-radius: calc(var(--radius) - 0.25rem) 0;
    padding: 0.25rem 0.75rem;
    margin-block: 0.25rem;
    font-size: 0.875rem;
    outline: none;

    &[data-disabled] {
      pointer-events: none;
      opacity: 0.5;
    }

    &[data-highlighted] {
      background: var(--accent);
      color: var(--accent-foreground);
    }
  }
</style>
