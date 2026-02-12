<script lang="ts">
    import { untrack } from "svelte";
    import { Tabs } from "bits-ui";
    import type Tower from "$lib/towerComponents/tower";
    import type SkinData from "$lib/towerComponents/skinData";
    import { settingsStore } from "$lib/stores/settings.svelte";
    import { towerStore } from "$lib/stores/tower.svelte";
    import { fade } from "svelte/transition";

    let {
        tower = null,
        onSave = undefined,
        disabled = false,
    }: {
        tower: Tower | null;
        onSave?: () => void;
        disabled?: boolean;
    } = $props();

    let selectedSkinName = $state("Regular");
    let availableSkins = $derived(tower ? tower.skinNames : []);
    let updateTrigger = $state(0);

    function cellKey(skinName: string, levelIndex: number, header: string) {
        return `${skinName}:${levelIndex}:${header}`;
    }

    function toNumberOrNull(v: unknown): number | null {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
            const s = v.trim();
            if (!s) return null;
            const n = Number(s);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }

    const INVERSE_STATS = new Set(["cooldown", "cost", "price"]);

    function isInverseStat(header: string): boolean {
        return INVERSE_STATS.has(header.trim().toLowerCase());
    }

    function formatNumberForDisplay(n: number): string {
        return String(Number(n.toFixed(2)));
    }

    function formatDelta(delta: number): string {
        const sign = delta > 0 ? "+" : "";
        return `${sign}${formatNumberForDisplay(delta)}`;
    }

    function computeDeltaClass(header: string, delta: number): string {
        if (delta === 0) return "";

        if (isInverseStat(header)) {
            return delta < 0 ? "text-green-500" : "text-red-500";
        }

        return delta > 0 ? "text-green-500" : "text-red-500";
    }

    function getBaselineValue(
        skinName: string,
        levelIndex: number,
        header: string,
    ): unknown {
        return towerStore.baseline[cellKey(skinName, levelIndex, header)];
    }

    function getDeltaForCell(
        skinData: SkinData,
        skinName: string,
        levelIndex: number,
        header: string,
    ): { delta: number | null; className: string } {
        const base = getBaselineValue(skinName, levelIndex, header);
        const current = skinData.levels.getCell(levelIndex, header);

        const baseN = toNumberOrNull(base);
        const currentN = toNumberOrNull(current);

        if (baseN == null || currentN == null) {
            return { delta: null, className: "" };
        }

        const delta = currentN - baseN;

        const normalized = Math.abs(delta) < 1e-12 ? 0 : delta;

        return {
            delta: normalized,
            className: computeDeltaClass(header, normalized),
        };
    }

    function getDisplayValueForCell(
        skinData: SkinData,
        header: string,
        value: unknown,
    ): string {
        if (value !== undefined && value !== null) {
            if (typeof value === "number") {
                return formatNumberForDisplay(value);
            }
            return String(value);
        }

        return "-";
    }

    $effect(() => {
        if (
            tower &&
            !availableSkins.includes(untrack(() => selectedSkinName))
        ) {
            selectedSkinName = availableSkins.includes("Regular")
                ? "Regular"
                : availableSkins[0] || "";
        }
    });

    function getTowerBaselineId(t: Tower): string {
        return (t as any)?.name ?? String(t);
    }

    function rebuildBaselineForSkin(t: Tower, skinName: string) {
        const skinData = t.getSkin(skinName);
        if (!skinData) return;

        const headers =
            skinData && skinData.headers.length > 0
                ? skinData.headers
                : skinData
                  ? skinData.levels.attributes
                  : [];
        const levels = skinData.levels.levels;

        const next: Record<string, unknown> = {};
        for (let i = 0; i < levels.length; i++) {
            for (const header of headers) {
                const value =
                    header === "Level" ? i : skinData.levels.getCell(i, header);

                next[cellKey(skinName, i, header)] = value;
            }
        }

        towerStore.baseline = next;
        towerStore.baselineTowerId = getTowerBaselineId(t);
        towerStore.baselineSkinName = skinName;
    }

    $effect(() => {
        const t = tower;
        if (!t) {
            towerStore.baseline = {};
            towerStore.baselineTowerId = null;
            towerStore.baselineSkinName = null;
            return;
        }

        const currentTowerId = getTowerBaselineId(t);
        if (towerStore.baselineTowerId !== currentTowerId) {
            const initial =
                availableSkins.includes("Regular")
                    ? "Regular"
                    : availableSkins[0] || "";
            if (initial) rebuildBaselineForSkin(t, initial);
        }
    });

    $effect(() => {
        const t = tower;
        const skinName = selectedSkinName;
        if (!t || !skinName) return;

        const currentTowerId = getTowerBaselineId(t);
        if (
            towerStore.baselineTowerId == null ||
            towerStore.baselineTowerId !== currentTowerId
        )
            return;

        if (towerStore.baselineSkinName == null) {
            rebuildBaselineForSkin(t, skinName);
        }
    });

    function isEditableForSkin(skinData: SkinData, attr: string) {
        if (!skinData) return false;
        if (skinData.readOnlyAttributes.includes(attr)) return false;
        if (attr === "Cost") return true;
        return skinData.locator.hasLocation(attr);
    }

    function updateStatForSkin(
        skinData: SkinData,
        levelIndex: number,
        attribute: string,
        value: string,
    ) {
        if (!skinData || disabled) return;

        let parsedValue: any = value;
        if (value === "true") parsedValue = true;
        else if (value === "false") parsedValue = false;
        else if (!isNaN(Number(value)) && value.trim() !== "")
            parsedValue = Number(value);

        if (settingsStore.debugMode) {
            console.log(
                `[TowerEditor] updateStat: Level ${levelIndex}, ${attribute} = ${parsedValue}`,
            );
        }

        skinData.set(levelIndex, attribute, parsedValue);
        updateTrigger++;
        towerStore.syncWikitext();
    }

    function handleDiscard() {
        towerStore.discardChanges();

        if (tower && selectedSkinName) {
            rebuildBaselineForSkin(tower, selectedSkinName);
        }

        updateTrigger++;
    }

    function handleSave() {
        towerStore.save();

        if (tower && selectedSkinName) {
            rebuildBaselineForSkin(tower, selectedSkinName);
        }
    }


</script>

<div class="space-y-4">
    {#if tower}
        {#key updateTrigger}
            <Tabs.Root
                value={selectedSkinName}
                onValueChange={(v) => (selectedSkinName = v)}
            >
                <Tabs.List class="tabs-list">
                    {#each availableSkins as skinName}
                        <Tabs.Trigger value={skinName} class="tab-trigger">
                            {skinName}
                        </Tabs.Trigger>
                    {/each}
                </Tabs.List>

                {#each availableSkins as skinName}
                    <Tabs.Content value={skinName}>
                        {@const skinData = tower.getSkin(skinName)}
                        {@const levels = skinData ? skinData.levels.levels : []}
                        {@const headers =
                            skinData && skinData.headers.length > 0
                                ? skinData.headers
                                : skinData
                                  ? skinData.levels.attributes
                                  : []}
                        {@const upgrades = skinData?.upgrades ?? []}
                        {#if skinData}
                            <div
                                class="table-container"
                                in:fade={{ duration: 200 }}
                            >
                                <table class="table">
                                    <thead class="table-head">
                                        <tr>
                                            {#each headers as header}
                                                <th
                                                    scope="col"
                                                    class={header === "Level"
                                                        ? "table-header-sticky px-2"
                                                        : "table-header whitespace-nowrap"}
                                                >
                                                    {header}
                                                </th>
                                            {/each}
                                        </tr>
                                    </thead>
                                    <tbody class="table-body">
                                        {#each levels as level, index (index)}
                                            <tr class="table-row">
                                                {#each headers as header (header)}
                                                    {#if header === "Level"}
                                                        <td
                                                            class="table-cell-sticky"
                                                        >
                                                            {index}
                                                        </td>
                                                    {:else}
                                                        <td class="table-data">
                                                            {#if isEditableForSkin(skinData, header)}
                                                                {@const baseValue =
                                                                    getBaselineValue(
                                                                        skinName,
                                                                        index,
                                                                        header,
                                                                    )}
                                                                {@const currentValue =
                                                                    skinData.levels.getCell(
                                                                        index,
                                                                        header,
                                                                    )}
                                                                {@const displayValue =
                                                                    getDisplayValueForCell(
                                                                        skinData,
                                                                        header,
                                                                        currentValue,
                                                                    )}
                                                                {@const deltaInfo =
                                                                    settingsStore.seeValueDifference
                                                                        ? getDeltaForCell(
                                                                              skinData,
                                                                              skinName,
                                                                              index,
                                                                              header,
                                                                          )
                                                                        : {
                                                                              delta: null,
                                                                              className:
                                                                                  "",
                                                                          }}
                                                                <div
                                                                    class="cell-wrapper"
                                                                >
                                                                    <input
                                                                        type="text"
                                                                        class="table-input"
                                                                        value={level[
                                                                            header
                                                                        ] ??
                                                                            ""}
                                                                        {disabled}
                                                                        onfocus={(
                                                                            e,
                                                                        ) => {
                                                                            e.currentTarget.dataset.original =
                                                                                e.currentTarget.value;
                                                                            e.currentTarget.value =
                                                                                "";
                                                                        }}
                                                                        onblur={(
                                                                            e,
                                                                        ) => {
                                                                            if (
                                                                                e
                                                                                    .currentTarget
                                                                                    .value ===
                                                                                ""
                                                                            ) {
                                                                                e.currentTarget.value =
                                                                                    e
                                                                                        .currentTarget
                                                                                        .dataset
                                                                                        .original ??
                                                                                    "";
                                                                            } else {
                                                                                updateStatForSkin(
                                                                                    skinData,
                                                                                    index,
                                                                                    header,
                                                                                    e
                                                                                        .currentTarget
                                                                                        .value,
                                                                                );
                                                                            }
                                                                        }}
                                                                        onkeydown={(
                                                                            e,
                                                                        ) => {
                                                                            if (
                                                                                e.key ===
                                                                                "Enter"
                                                                            ) {
                                                                                e.currentTarget.blur();
                                                                            }
                                                                        }}
                                                                    />
                                                                    {#if settingsStore.seeValueDifference && deltaInfo.delta !== null && deltaInfo.delta !== 0}
                                                                        <span
                                                                            class={`delta-text ${deltaInfo.className}`}
                                                                        >
                                                                            ({formatDelta(
                                                                                deltaInfo.delta,
                                                                            )})
                                                                        </span>
                                                                    {/if}
                                                                </div>
                                                            {:else}
                                                                <div
                                                                    class="table-cell-readonly"
                                                                >
                                                                    {getDisplayValueForCell(
                                                                        skinData,
                                                                        header,
                                                                        level[
                                                                            header
                                                                        ],
                                                                    )}
                                                                </div>
                                                            {/if}
                                                        </td>
                                                    {/if}
                                                {/each}
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {:else}
                            <div class="text-center py-4 text-muted-foreground">
                                No skin data available for {skinName}
                            </div>
                        {/if}
                    </Tabs.Content>
                {/each}
            </Tabs.Root>
        {/key}

        <div class="flex justify-end gap-2 mt-4 border-t pt-4">
            <button
                class="btn btn-secondary"
                onclick={handleDiscard}
                disabled={!towerStore.isDirty}
            >
                Clear Changes
            </button>
            <button
                class="btn btn-primary"
                onclick={handleSave}
                disabled={!towerStore.isDirty}
            >
                Save Changes
            </button>
        </div>
    {:else}
        <div class="text-center py-8 text-body">
            Select a tower to edit its skins.
        </div>
    {/if}
</div>
