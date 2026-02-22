<script lang="ts">
    import { untrack } from "svelte";
    import { Tabs } from "bits-ui";
    import Separator from "./smol/Separator.svelte";
    import type Tower from "$lib/towerComponents/tower";
    import type SkinData from "$lib/towerComponents/skinData";
    import { settingsStore } from "$lib/stores/settings.svelte";
    import { towerStore } from "$lib/stores/tower.svelte";
    import { fade } from "svelte/transition";
    import MoneyIcon from "$lib/assets/Income.png";
    import { formatNumber, formatValue } from "$lib/utils/format";

    let {
        tower = null,
        disabled = false,
    }: {
        tower: Tower | null;
        disabled?: boolean;
    } = $props();

    let availableSkins = $derived(tower ? tower.skinNames : []);


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

    function formatDelta(delta: number): string {
        const sign = delta > 0 ? "+" : "";
        return `${sign}${formatNumber(delta)}`;
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

    $effect(() => {
        if (
            tower &&
            !availableSkins.includes(untrack(() => towerStore.selectedSkinName))
        ) {
            towerStore.selectedSkinName = availableSkins.includes("Regular")
                ? "Regular"
                : availableSkins[0] || "";
        }
    });

    function getTowerBaselineId(t: Tower): string {
        return (t as any)?.name ?? String(t);
    }

    let selectedSkinName = $derived(towerStore.selectedSkinName);

    function rebuildBaselineForSkin(t: Tower, skinName: string) {
        if (settingsStore.debugMode) {
            console.log(
                `[TowerEditor] Rebuilding baseline for ${t.name} (skin: ${skinName})`,
            );
        }
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
        towerStore.refresh();
        towerStore.syncWikitext();
    }

    async function handleDiscard() {
        if (settingsStore.debugMode) {
            console.log(
                `[TowerEditor] Discard requested (tower=${tower?.name ?? "null"}, skin=${selectedSkinName})`,
            );
        }

        if (settingsStore.debugMode) {
            console.log(`[TowerEditor] Discard: awaiting store reload...`);
        }

        await towerStore.discardChanges();

        if (settingsStore.debugMode) {
            console.log(
                `[TowerEditor] Discard: reload complete (tower=${tower?.name ?? "null"}, skin=${selectedSkinName}); rebuilding baseline...`,
            );
        }

        if (tower && selectedSkinName) {
            rebuildBaselineForSkin(tower, selectedSkinName);
        }

        towerStore.refresh();
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
        {#key towerStore.refreshTrigger}
            <Tabs.Root
                value={towerStore.selectedSkinName}
                onValueChange={(v) => (towerStore.selectedSkinName = v)}
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
                                                        <td class="table-data">
                                                            {#if isEditableForSkin(skinData, header)}
                                                                <div
                                                                    class="cell-wrapper {skinData.moneyColumns.includes(header) ? 'money-wrapper' : ''}"
                                                                >
                                                                    {#if skinData.moneyColumns.includes(header)}
                                                                        <img src={MoneyIcon} alt="" class="money-icon money-icon-input" />
                                                                    {/if}
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
                                                                    class="table-cell-readonly flex items-center justify-between gap-2"
                                                                >
                                                                    {#if skinData.moneyColumns.includes(header)}
                                                                        <span class="money-value">
                                                                            <img src={MoneyIcon} alt="" class="money-icon" />
                                                                            {formatValue(level[header])}
                                                                        </span>
                                                                    {:else}
                                                                        <span>
                                                                            {formatValue(level[header])}
                                                                        </span>
                                                                    {/if}
                                                                    {#if settingsStore.seeValueDifference && deltaInfo.delta !== null && deltaInfo.delta !== 0}
                                                                        <span
                                                                            class={`delta-text text-xs ${deltaInfo.className}`}
                                                                        >
                                                                            ({formatDelta(
                                                                                deltaInfo.delta,
                                                                            )})
                                                                        </span>
                                                                    {/if}
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

        <Separator class="mt-4" />
        <div class="flex justify-end gap-2 pt-4">
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

<style>
    .table-container {
        overflow-x: auto;
        border: 1px solid var(--border);
        background: var(--card);
    }

    .table {
        min-width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;

        thead,
        tbody {
            border-color: var(--border);

            tr {
                border-bottom: 1px solid var(--border);
            }
        }
    }

    .table-head {
        background: var(--muted);
    }

    .table-body {
        background: var(--card);

        tr {
            border-bottom: 1px solid var(--border);
        }
    }

    .table-row:hover {
        background: var(--accent);
    }

    .table-header {
        padding: 0.5rem 0.75rem;
        text-align: left;
        font-weight: 600;
        color: var(--foreground);
    }

    .table-cell {
        padding: 0.5rem 0.75rem;
        font-weight: 500;
        color: var(--foreground);
    }

    .table-cell-sticky {
        position: sticky;
        left: 0;
        background: var(--card);
        z-index: 7;
        text-align: center;
    }

    .table-data {
        padding: 0.25rem;
        min-width: 100px;
    }

    .cell-wrapper {
        display: flex;
        align-items: center;
        width: 100%;
        border-radius: var(--radius) 0;
        border: 1px solid var(--input);
        background: transparent;
        padding: 0.25rem 0.75rem;
        transition: border-color 0.2s;

        &:focus-within {
            border-color: var(--ring);
        }
    }

    .table-input {
        display: block;
        width: 100%;
        border: none;
        background: transparent;
        padding: 0;
        font-size: 0.875rem;
        outline: none;
        flex: 1;
        min-width: 0;
    }

    .table-cell-readonly {
        padding: 0.25rem 0.75rem;
        color: var(--muted-foreground);
        font-style: italic;
        background: var(--muted);
        border-radius: var(--radius) 0;
    }

    .delta-text {
        font-size: 0.75rem;
        line-height: 1rem;
        white-space: nowrap;
    }

    .money-icon {
        width: 1.1em;
        height: 1.1em;
        object-fit: contain;
        vertical-align: middle;
        display: inline;
        flex-shrink: 0;
    }

    .money-icon-input {
        opacity: 0.75;
    }

    .money-wrapper {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .money-value {
        color: #44E500;
        text-shadow:
            0 0 0.09375em black,
            0 0 0.09375em black,
            0 0 0.09375em black,
            0 0 0.09375em black,
            0 0 0.09375em black;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
</style>
