<script lang="ts">
    import { towerStore } from "$lib/stores/tower.svelte";
    import FlyingIcon from "$lib/assets/FlyingDetection.png";
    import HiddenIcon from "$lib/assets/HiddenDetection.png";
    import LeadIcon from "$lib/assets/LeadDetection.png";
    import { Select } from "bits-ui";
    import { Check, ChevronDown } from "@lucide/svelte";

    let skinData = $derived(
        towerStore.selectedData?.getSkin(towerStore.selectedData.skinNames[0]),
    );
    let levels = $derived(skinData?.levels.levels ?? []);

    let levelOptions = $derived([
        { value: "none", label: "∅" },
        ...levels.map((_, i) => ({ value: i.toString(), label: `Lvl ${i}` })),
    ]);

    const detectionTypes = [
        { type: "Hidden" as const, icon: HiddenIcon },
        { type: "Flying" as const, icon: FlyingIcon },
        { type: "Lead" as const, icon: LeadIcon },
    ];

    function getDetectionStartLevel(type: "Hidden" | "Flying" | "Lead"): number | null {
        if (!levels.length) return null;
        for (let i = 0; i < levels.length; i++) {
            if (levels[i][type]) {
                return i;
            }
        }
        return null;
    }

    function updateDetectionStart(type: "Hidden" | "Flying" | "Lead", startLevel: number | null) {
        if (!skinData) return;

        const totalLevels = levels.length;
        if (startLevel === null) {
             for (let i = 0; i < totalLevels; i++) {
                skinData.setDetection(i, type, false);
            }
            towerStore.save();
            return;
        }

        for (let i = 0; i < totalLevels; i++) {
            const shouldHave = i >= startLevel;
            skinData.setDetection(i, type, shouldHave, i === totalLevels - 1);
        }
        towerStore.save();
    }
</script>

<div class="space-y-4 pt-4 border-t border-border">
    <h3 class="text-sm font-semibold text-foreground px-1">Detections</h3>

    {#if skinData}
        <div class="grid gap-2">
            {#each detectionTypes as detection}
                <div class="detection-row">
                    <div class="flex items-center gap-3">
                        <img
                            src={detection.icon}
                            alt="{detection.type} Detection"
                            class="w-5 h-5 dark:invert-0 invert opacity-80"
                        />
                        <span class="text-xs font-medium">{detection.type}</span>
                    </div>

                    <Select.Root
                        type="single"
                        items={levelOptions}
                        value={getDetectionStartLevel(detection.type)?.toString() ??
                            "none"}
                        onValueChange={(val) =>
                            updateDetectionStart(
                                detection.type,
                                val === "none" ? null : parseInt(val),
                            )}
                    >
                        <Select.Trigger class="select-trigger w-22.5 h-7">
                            {@const val =
                                getDetectionStartLevel(detection.type)?.toString() ??
                                "none"}
                            <span class="truncate">
                                {levelOptions.find((o) => o.value === val)?.label}
                            </span>
                            <ChevronDown class="w-3 h-3 opacity-50 ml-1" />
                        </Select.Trigger>
                        <Select.Portal>
                            <Select.Content
                                class="select-content max-h-55"
                                sideOffset={5}
                            >
                                <Select.Viewport class="p-1">
                                    {#each levelOptions as option (option.value)}
                                        <Select.Item
                                            class="select-item p-1 px-3 my-1 text-sm"
                                            value={option.value}
                                            label={option.label}
                                        >
                                            {#snippet children({ selected })}
                                                {option.label}
                                                {#if selected}
                                                    <div class="ml-auto">
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
                </div>
            {/each}
        </div>
    {:else}
        <p class="text-xs text-muted-foreground px-1">
            Select a tower to edit detections.
        </p>
    {/if}
</div>
