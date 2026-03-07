<script lang="ts">
    import { untrack } from "svelte";
    import { Tabs } from "bits-ui";
    import Separator from "./smol/Separator.svelte";
    import type Tower from "$lib/towerComponents/tower";
    import type SkinData from "$lib/towerComponents/skinData";
    import { settingsStore } from "$lib/stores/settings.svelte";
    import { towerStore } from "$lib/stores/tower.svelte";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import MoneyIcon from "$lib/assets/Income.png";
    import { formatNumber, formatValue } from "$lib/utils/format";
    import { renderCellHtml } from "$lib/neowtext/render";

    let {
        tower = null,
        disabled = false,
    }: {
        tower: Tower | null;
        disabled?: boolean;
    } = $props();

    let availableSkins = $derived(tower ? tower.skinNames : []);

    function focusOnMount(node: HTMLElement) {
        node.focus();
    }

    let focusedCell = $state<string | null>(null);

    function mkCellKey(skinName: string, tableIdx: number, rowIdx: number, header: string): string {
        return `${skinName}:${tableIdx}:${rowIdx}:${header}`;
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

    function baselineCellKey(skinName: string, levelIndex: number, header: string) {
        return `${skinName}:${levelIndex}:${header}`;
    }

    function getBaselineValue(skinName: string, levelIndex: number, header: string): unknown {
        return towerStore.baseline[baselineCellKey(skinName, levelIndex, header)];
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
                next[baselineCellKey(skinName, i, header)] = value;
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

    function updateRowStat(
        row: Record<string, string | number>,
        header: string,
        value: string,
    ) {
        if (disabled) return;
        let parsedValue: string | number = value;
        if (!isNaN(Number(value)) && value.trim() !== "")
            parsedValue = Number(value);
        row[header] = parsedValue;
        towerStore.refresh();
        towerStore.syncWikitext();
    }

    async function handleDiscard() {
        if (settingsStore.debugMode) {
            console.log(
                `[TowerEditor] Discard requested (tower=${tower?.name ?? "null"}, skin=${selectedSkinName})`,
            );
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

    interface TableConfig {
        skinName: string;
        tableIdx: number;
        tableName: string;
        headers: string[];
        rows: Record<string, string | number>[];
        moneyColumns: string[];
        readOnlyColumns: string[];
        skinData: SkinData | null;
    }

    function isCellEditable(config: TableConfig, header: string): boolean {
        if (config.skinData) return isEditableForSkin(config.skinData, header);
        return !config.readOnlyColumns.includes(header);
    }

    function commitEdit(config: TableConfig, rowIdx: number, header: string, value: string) {
        if (config.skinData) {
            updateStatForSkin(config.skinData, rowIdx, header, value);
        } else {
            updateRowStat(config.rows[rowIdx], header, value);
        }
    }
</script>

{#snippet dataTable(config: TableConfig, isFirst: boolean)}
    <div
        class="table-container {!isFirst ? 'extra-table-container' : ''} {settingsStore.minTableWidth ? 'min-content' : ''}"
        in:fly={isFirst ? { y: 8, duration: 160, easing: cubicOut } : { duration: 0 }}
    >
        <table class="table {settingsStore.minTableWidth ? 'min-content' : ''}">
            <thead class="table-head">
                {#if config.tableName}
                    <tr>
                        <th colspan={config.headers.length} class="table-name-header">
                            {config.tableName}
                        </th>
                    </tr>
                {/if}
                <tr>
                    {#each config.headers as header (header)}
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
                {#each config.rows as row, rowIdx (rowIdx)}
                    <tr class="table-row">
                        {#each config.headers as header (header)}
                            {#if header === "Level"}
                                <td class="table-cell-sticky">
                                    {row[header] ?? rowIdx}
                                </td>
                            {:else}
                                {@const editable = isCellEditable(config, header)}
                                {@const deltaInfo =
                                    config.skinData && settingsStore.seeValueDifference
                                        ? getDeltaForCell(config.skinData, config.skinName, rowIdx, header)
                                        : { delta: null, className: "" }}
                                {@const isMoney = config.moneyColumns.includes(header)}
                                {@const ck = mkCellKey(config.skinName, config.tableIdx, rowIdx, header)}
                                {@const cellVal = config.rows[rowIdx]?.[header]}
                                {@const isFocused = focusedCell === ck}
                                <td class="table-data">
                                    {#if editable}
                                        <div
                                            class="cell-wrapper {isMoney ? 'money-wrapper' : ''} {settingsStore.hideCellWrapper ? 'hide-wrapper' : ''}"
                                        >
                                            {#if isMoney}
                                                <img src={MoneyIcon} alt="" class="money-icon money-icon-input" />
                                            {/if}
                                            {#if isFocused}
                                                <input
                                                    use:focusOnMount
                                                    type="text"
                                                    class="table-input"
                                                    value={formatValue(cellVal)}
                                                    {disabled}
                                                    onfocus={(e) => {
                                                        e.currentTarget.dataset.original = e.currentTarget.value;
                                                        if (settingsStore.clearOnEdit) e.currentTarget.value = "";
                                                    }}
                                                    onblur={(e) => {
                                                        focusedCell = null;
                                                        const next = e.currentTarget.value;
                                                        const original = e.currentTarget.dataset.original ?? "";
                                                        if (next === "") {
                                                            e.currentTarget.value = original;
                                                        } else if (next !== original) {
                                                            commitEdit(config, rowIdx, header, next);
                                                        }
                                                    }}
                                                    onkeydown={(e) => {
                                                        if (e.key === "Enter") e.currentTarget.blur();
                                                        if (e.key === "Escape") {
                                                            e.currentTarget.value = e.currentTarget.dataset.original ?? "";
                                                            focusedCell = null;
                                                        }
                                                    }}
                                                />
                                            {:else}
                                                <button
                                                    type="button"
                                                    class="cell-display"
                                                    {disabled}
                                                    onclick={() => { focusedCell = ck; }}
                                                >
                                                    {@html renderCellHtml(cellVal, false)}
                                                </button>
                                            {/if}
                                            {#if settingsStore.seeValueDifference && deltaInfo.delta !== null && deltaInfo.delta !== 0}
                                                <span class={`delta-text ${deltaInfo.className}`}>
                                                    ({formatDelta(deltaInfo.delta)})
                                                </span>
                                            {/if}
                                        </div>
                                    {:else}
                                        <div
                                            class="table-cell-readonly flex items-center justify-between gap-2 {settingsStore.hideCellWrapper ? 'hide-wrapper' : ''}"
                                        >
                                            {#if isMoney}
                                                <span class="money-value">
                                                    <img src={MoneyIcon} alt="" class="money-icon" />
                                                    {@html renderCellHtml(cellVal, true)}
                                                </span>
                                            {:else}
                                                <span class="cell-multiline">
                                                    {@html renderCellHtml(cellVal, true)}
                                                </span>
                                            {/if}
                                            {#if settingsStore.seeValueDifference && deltaInfo.delta !== null && deltaInfo.delta !== 0}
                                                <span class={`delta-text text-xs ${deltaInfo.className}`}>
                                                    ({formatDelta(deltaInfo.delta)})
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
{/snippet}

<div class="space-y-4">
    {#if tower}
        {#key towerStore.refreshTrigger}
            <Tabs.Root
                value={towerStore.selectedSkinName}
                onValueChange={(v) => (towerStore.selectedSkinName = v)}
            >
                <Tabs.List class="tabs-list">
                    {#each availableSkins as skinName (skinName)}
                        <Tabs.Trigger value={skinName} class="tab-trigger">
                            {skinName}
                        </Tabs.Trigger>
                    {/each}
                </Tabs.List>

                {#each availableSkins as skinName (skinName)}
                    <Tabs.Content value={skinName}>
                        {@const skinData = tower.getSkin(skinName)}
                        {#if skinData && towerStore.selectedSkinName === skinName}
                            {@const headers =
                                skinData.headers.length > 0
                                    ? skinData.headers
                                    : skinData.levels.attributes}
                            {@const primaryConfig = {
                                skinName,
                                tableIdx: 0,
                                tableName: skinData.tableName,
                                headers,
                                rows: skinData.levels.levels,
                                moneyColumns: skinData.moneyColumns,
                                readOnlyColumns: [],
                                skinData,
                            }}
                            {@render dataTable(primaryConfig, true)}

                            {#if skinData.extraTables?.length}
                                {#each skinData.extraTables as extraTable, tableIdx (tableIdx)}
                                    {@const extraConfig = {
                                        skinName,
                                        tableIdx: tableIdx + 1,
                                        tableName: extraTable.name,
                                        headers: extraTable.headers,
                                        rows: extraTable.rows,
                                        moneyColumns: extraTable.moneyColumns,
                                        readOnlyColumns: extraTable.readOnlyColumns,
                                        skinData: null,
                                    }}
                                    {@render dataTable(extraConfig, false)}
                                {/each}
                            {/if}
                        {:else if towerStore.selectedSkinName === skinName}
                            <div class="text-center py-4 text-muted-foreground">
                                No skin data available.
                            </div>
                        {/if}
                    </Tabs.Content>
                {/each}
            </Tabs.Root>
        {/key}

        <Separator class="mt-4" />
        <div class="flex justify-end gap-2">
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
    @reference "../../routes/layout.css";

    .table-container {
        overflow-x: auto;
        border: 1px solid var(--border);
        background: var(--card);

        &.min-content {
            width: max-content;
            max-width: 100%;
        }
    }

    .extra-table-container {
        margin-top: 0.75rem;
    }

    .table-name-header {
        padding: 0.4rem 0.75rem;
        text-align: center;
        font-weight: 700;
        font-size: 0.8rem;
        color: var(--foreground);
        border-bottom: 1px solid var(--border);
        @apply bg-secondary/40;
    }

    .table {
        min-width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;

        &.min-content {
            min-width: 0;
            width: min-content;
        }

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

            &:nth-child(even) {
                background: var(--secondary);

                .table-cell-sticky {
                    background: var(--secondary);
                }
            }
        }
    }

    tr.table-row:hover {
        background: var(--accent);

        .table-cell-sticky {
            background: var(--accent);
        }
    }

    .table-header {
        padding: 0.5rem 0.75rem;
        text-align: left;
        font-weight: 600;
        color: var(--foreground);
    }

    .table-header-sticky {
        position: sticky;
        left: 0;
        background: var(--muted);
        z-index: 7;
        text-align: center;
        font-weight: 600;
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
        vertical-align: top;
    }

    .cell-wrapper {
        display: flex;
        align-items: flex-start;
        width: 100%;
        border-radius: var(--radius) 0;
        border: 1px solid var(--input);
        background: transparent;
        padding: 0.25rem 0.75rem;
        transition: border-color 0.25s;

        &:focus-within {
            border-color: var(--ring);
        }

        &.hide-wrapper {
            border-color: transparent;
            padding: 0.1rem;

            &:focus-within {
                border-color: transparent;
            }
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
        border: 1px solid var(--border);
        cursor: not-allowed;

        &.hide-wrapper {
            background: transparent;
            padding: 0.1rem;
        }
    }

    .cell-multiline {
        white-space: pre-line;
    }

    .cell-display {
        display: block;
        width: 100%;
        padding: 0;
        cursor: text;
        line-height: 1.4;
        white-space: normal;
        background: none;
        border: none;
        text-align: left;
        font: inherit;
        color: inherit;

        &:disabled {
            cursor: default;
        }
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
