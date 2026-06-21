<script lang="ts">
  import { towerStore } from "$lib/stores/tower.svelte";
  import { getTargetSkins } from "$lib/utils/towah";
  import HiddenIcon from "$lib/assets/HiddenDetection.png";
  import LeadIcon from "$lib/assets/LeadDetection.png";
  import FlyingIcon from "$lib/assets/FlyingDetection.png";
  import { Select } from "bits-ui";
  import { Check, ChevronDown, ScanEye } from "@lucide/svelte";
  import CollapsibleSection from "./smol/CollapsibleSection.svelte";
  import SubtleRow from "./smol/SubtleRow.svelte";

  let open = $state(true);
  let skinData = $derived(
    towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
  );
  let levels = $derived(skinData?.levels.levels ?? []);

  let levelOptions = $derived([
    { value: "none", label: "∅" },
    ...levels.map((_, i) => {
      const upg = skinData?.upgrades[i - 1];
      const displayLvl =
        i === 0 ? "0" : (upg?.upgradeData?.Level ?? i.toString());
      return { value: i.toString(), label: `Lvl. ${displayLvl}` };
    }),
  ]);

  const detectionTypes = [
    { type: "Hidden" as const, icon: HiddenIcon },
    { type: "Lead" as const, icon: LeadIcon },
    { type: "Flying" as const, icon: FlyingIcon },
  ];

  let selectedDetectionStart = $state<
    Record<"Hidden" | "Lead" | "Flying", string>
  >({
    Hidden: "none",
    Lead: "none",
    Flying: "none",
  });

  $effect(() => {
    selectedDetectionStart = {
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
    selectedDetectionStart[type] =
      startLevel === null ? "none" : startLevel.toString();

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

    towerStore.save();
    towerStore.refresh();
  }
</script>

<CollapsibleSection
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
            <Select.Trigger
              class="inline-flex h-7 w-22.5 items-center justify-between rounded-[var(--radius)_0] border border-input bg-background px-4 text-sm transition-colors duration-250 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground"
            >
              <span class="truncate">
                {levelOptions.find(
                  (o) => o.value === selectedDetectionStart[detection.type],
                )?.label}
              </span>
              <ChevronDown class="w-3 h-3 opacity-50 ms-1" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                class="z-50 min-w-32 max-h-55 overflow-hidden rounded-[var(--radius)_0] border border-border bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                sideOffset={5}
              >
                <Select.Viewport class="p-1">
                  {#each levelOptions as option (option.value)}
                    <Select.Item
                      class="relative flex w-full select-none items-center rounded-[calc(var(--radius)-0.25rem)_0] p-1 px-3 my-1 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
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
</CollapsibleSection>
