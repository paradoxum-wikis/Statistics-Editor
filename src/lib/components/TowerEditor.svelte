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
  import {
    formatNumber,
    formatValue,
    applyROFBug,
    stripRefs,
    toDisplayNumber,
    getROFVer,
  } from "$lib/utils/format";
  import { renderCellHtml } from "$lib/neowtext/render";
  import { resolveToken } from "$lib/neowtext/functions";

  let {
    tower = null,
    disabled = false,
  }: {
    tower: Tower | null;
    disabled?: boolean;
  } = $props();

  const availableSkins = $derived(tower?.skinNames ?? []);
  const selectedSkinName = $derived(towerStore.selectedSkinName);

  const activeSkinData = $derived.by(() => {
    towerStore.refreshTrigger;
    if (!tower) return null;
    const skin = tower.getSkin(towerStore.selectedSkinName);
    if (!skin) return null;
    return {
      skin,
      headers: skin.headers.length > 0 ? skin.headers : skin.levels.attributes,
      rows: [...skin.levels.levels],
      extraTables:
        skin.extraTables?.map((t) => ({ ...t, rows: [...t.rows] })) ?? [],
    };
  });

  let rofInfo = $derived.by(() => {
    const tokens = tower?.getSkin(selectedSkinName)?.formulaTokens;
    const info = getROFVer(tokens);
    return {
      type: info.type,
      cols: new Set(info.cols),
    };
  });

  let focusedCell = $state<string | null>(null);

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function mkCellKey(
    skinName: string,
    tableIdx: number,
    rowIdx: number,
    header: string,
  ): string {
    return `${skinName}:${tableIdx}:${rowIdx}:${header}`;
  }

  const INVERSE_STATS = new Set(["cooldown", "cost", "price"]);

  function formatDelta(delta: number): string {
    return `${delta > 0 ? "+" : ""}${formatNumber(delta)}`;
  }

  function computeDeltaClass(header: string, delta: number): string {
    if (delta === 0) return "";
    const inv = INVERSE_STATS.has(stripRefs(header).trim().toLowerCase());
    return (inv ? delta < 0 : delta > 0) ? "text-green-500" : "text-red-500";
  }

  function getDeltaForCell(
    currentValue: string | number | undefined,
    skinName: string,
    tableIdx: number,
    levelIndex: number,
    header: string,
  ): { delta: number | null; className: string } {
    const baseN = toDisplayNumber(
      towerStore.baseline[mkCellKey(skinName, tableIdx, levelIndex, header)],
    );
    const currentN = toDisplayNumber(currentValue);

    if (baseN == null || currentN == null)
      return { delta: null, className: "" };

    const delta = currentN - baseN;
    return {
      delta: Math.abs(delta) < 1e-9 ? 0 : delta,
      className: computeDeltaClass(header, delta),
    };
  }

  function rebuildBaselineForSkin(t: Tower, skinName: string) {
    if (settingsStore.debugMode) {
      console.log(
        `[TowerEditor] Rebuilding baseline for ${t.name} (skin: ${skinName})`,
      );
    }
    const skinData = t.getSkin(skinName);
    if (!skinData) return;

    const headers =
      skinData.headers.length > 0
        ? skinData.headers
        : skinData.levels.attributes;
    const next: Record<string, string | number | boolean> = {};
    const { levels } = skinData.levels;

    for (let i = 0; i < levels.length; i++) {
      for (const header of headers) {
        next[mkCellKey(skinName, 0, i, header)] =
          header === "Level" ? i : skinData.levels.getCell(i, header);
      }
    }

    if (skinData.extraTables) {
      skinData.extraTables.forEach((extTable, idx) => {
        const tableIdx = idx + 1;
        for (let i = 0; i < extTable.rows.length; i++) {
          for (const header of extTable.headers) {
            next[mkCellKey(skinName, tableIdx, i, header)] =
              header === "Level" ? i : extTable.rows[i][header];
          }
        }
      });
    }

    towerStore.baseline = next;
    towerStore.baselineTowerId = t.name;
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
    if (
      towerStore.baselineTowerId !== t.name ||
      towerStore.baselineSkinName == null
    ) {
      const skin = availableSkins.includes("Regular")
        ? "Regular"
        : (availableSkins[0] ?? "");
      if (skin) rebuildBaselineForSkin(t, skin);
    }
  });

  function updateStatForSkin(
    skinData: SkinData,
    levelIndex: number,
    attribute: string,
    value: string,
  ) {
    if (!skinData || disabled) return;
    let parsedValue: string | number | boolean = value;
    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (value.trim() !== "" && !isNaN(Number(value)))
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
    const n = Number(value);
    row[header] = value.trim() !== "" && !isNaN(n) ? n : value;
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
      console.log(`[TowerEditor] Discard complete; rebuilding baseline...`);
    }
    if (tower && selectedSkinName)
      rebuildBaselineForSkin(tower, selectedSkinName);
    towerStore.refresh();
  }

  function handleSave() {
    towerStore.save();
    if (tower && selectedSkinName)
      rebuildBaselineForSkin(tower, selectedSkinName);
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
    formulaTokens?: Record<string, string>;
    cellFormulaTokens?: Record<string, Record<string, string>>;
    isPvp?: boolean;
  }

  function isCellEditable(config: TableConfig, header: string): boolean {
    const clean = stripRefs(header);
    return config.skinData
      ? !config.skinData.readOnlyAttributes.includes(clean) &&
          (clean !== "Cost" || config.skinData.locator.hasLocation(header))
      : !config.readOnlyColumns.includes(clean);
  }

  function commitEdit(
    config: TableConfig,
    rowIdx: number,
    header: string,
    value: string,
  ) {
    if (config.skinData) {
      updateStatForSkin(config.skinData, rowIdx, header, value);
    } else {
      updateRowStat(config.rows[rowIdx], header, value);
    }
  }

  function buildDisplayRows(
    config: TableConfig,
  ): Record<string, string | number>[] {
    return config.rows.map((r, rowIdx) => {
      const keyMap = new Map<string, string>();
      for (const k of Object.keys(r)) keyMap.set(k, stripRefs(k));

      const cleanRow: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(r)) {
        const ck = keyMap.get(k)!;
        if (settingsStore.rofBug && rofInfo.cols.has(ck)) {
          const n = Number(v);
          cleanRow[ck] =
            !isNaN(n) && n !== 0
              ? applyROFBug(n, rofInfo.type)
              : (v as string | number);
        } else {
          cleanRow[ck] = v as string | number;
        }
      }

      const cellTokens =
        config.skinData?.cellFormulaTokens ?? config.cellFormulaTokens;
      const fTokens =
        config.skinData?.formulaTokens ?? config.formulaTokens ?? {};
      const isPvp = config.skinData?.isPvp ?? config.isPvp ?? false;
      const tokens = cellTokens?.[String(rowIdx)];
      if (tokens) {
        for (let pass = 0; pass < 2; pass++) {
          for (const [col, tok] of Object.entries(tokens)) {
            const res = resolveToken(tok, rowIdx, cleanRow, fTokens, isPvp);
            if (res != null) cleanRow[stripRefs(col)] = res;
          }
        }
      }

      const outRow = { ...r };
      for (const k of Object.keys(r))
        outRow[k] = cleanRow[keyMap.get(k)!] ?? r[k];
      return outRow;
    });
  }
</script>

{#snippet dataTable(config: TableConfig, isFirst: boolean)}
  {@const displayRows = buildDisplayRows(config)}
  <div
    class="table-container {!isFirst
      ? 'extra-table-container'
      : ''} {settingsStore.minTableWidth ? 'min-content' : ''}"
    in:fly={isFirst
      ? { y: 8, duration: 160, easing: cubicOut }
      : { duration: 0 }}
  >
    <table class="table {settingsStore.minTableWidth ? 'min-content' : ''}">
      <thead class="table-head">
        {#if config.tableName}
          <tr>
            <th colspan={config.headers.length} class="table-name-header">
              {@html renderCellHtml(config.tableName, true)}
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
              {@html renderCellHtml(header, true)}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody class="table-body">
        {#each displayRows as row, rowIdx (rowIdx)}
          <tr class="table-row">
            {#each config.headers as header (header)}
              {#if header === "Level"}
                <td class="table-cell-sticky">
                  {row[header] ?? rowIdx}
                </td>
              {:else}
                {@const editable = isCellEditable(config, header)}
                {@const deltaInfo = settingsStore.seeValueDifference
                  ? getDeltaForCell(
                      config.rows[rowIdx]?.[header],
                      config.skinName,
                      config.tableIdx,
                      rowIdx,
                      header,
                    )
                  : { delta: null, className: "" }}
                {@const isMoney = config.moneyColumns.includes(header)}
                {@const ck = mkCellKey(
                  config.skinName,
                  config.tableIdx,
                  rowIdx,
                  header,
                )}
                {@const isFocused = focusedCell === ck}
                <td class="table-data">
                  {#if editable}
                    <div
                      class="cell-wrapper {isMoney
                        ? 'money-wrapper'
                        : ''} {settingsStore.hideCellWrapper
                        ? 'hide-wrapper'
                        : ''}"
                    >
                      {#if isMoney}
                        <img
                          src={MoneyIcon}
                          alt=""
                          class="money-icon money-icon-input"
                        />
                      {/if}
                      {#if isFocused}
                        <input
                          use:focusOnMount
                          type="text"
                          size="1"
                          class="table-input"
                          value={formatValue(config.rows[rowIdx]?.[header])}
                          {disabled}
                          onfocus={(e) => {
                            e.currentTarget.dataset.original =
                              e.currentTarget.value;
                            if (settingsStore.clearOnEdit)
                              e.currentTarget.value = "";
                          }}
                          onblur={(e) => {
                            focusedCell = null;
                            const next = e.currentTarget.value;
                            const original =
                              e.currentTarget.dataset.original ?? "";
                            if (next === "") {
                              e.currentTarget.value = original;
                            } else if (next !== original) {
                              commitEdit(config, rowIdx, header, next);
                            }
                          }}
                          onkeydown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              e.currentTarget.value =
                                e.currentTarget.dataset.original ?? "";
                              focusedCell = null;
                            }
                          }}
                        />
                      {:else}
                        <button
                          type="button"
                          class="cell-display"
                          {disabled}
                          onclick={() => {
                            focusedCell = ck;
                          }}
                        >
                          {@html renderCellHtml(row[header], false)}
                        </button>
                      {/if}
                      {#if settingsStore.seeValueDifference && deltaInfo.delta !== null && deltaInfo.delta !== 0}
                        <span class="delta-text {deltaInfo.className}">
                          ({formatDelta(deltaInfo.delta)})
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <div
                      class="table-cell-readonly flex items-center justify-between gap-2 {settingsStore.hideCellWrapper
                        ? 'hide-wrapper'
                        : ''}"
                    >
                      {#if isMoney}
                        <span class="money-value">
                          <img src={MoneyIcon} alt="" class="money-icon" />
                          {@html renderCellHtml(row[header], true)}
                        </span>
                      {:else}
                        <span class="cell-multiline">
                          {@html renderCellHtml(row[header], true)}
                        </span>
                      {/if}
                      {#if settingsStore.seeValueDifference && deltaInfo.delta !== null && deltaInfo.delta !== 0}
                        <span class="delta-text text-xs {deltaInfo.className}">
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
    <Tabs.Root
      value={towerStore.selectedSkinName}
      onValueChange={(v) => (towerStore.selectedSkinName = v)}
    >
      <Tabs.List class="tabs-list">
        {#each availableSkins as skinName (skinName)}
          <Tabs.Trigger value={skinName} class="tab-trigger"
            >{skinName}</Tabs.Trigger
          >
        {/each}
      </Tabs.List>

      {#each availableSkins as skinName (skinName)}
        <Tabs.Content value={skinName}>
          {#if activeSkinData}
            {@render dataTable(
              {
                skinName,
                tableIdx: 0,
                tableName: activeSkinData.skin.tableName,
                headers: activeSkinData.headers,
                rows: activeSkinData.rows,
                moneyColumns: activeSkinData.skin.moneyColumns,
                readOnlyColumns: [],
                skinData: activeSkinData.skin,
              },
              true,
            )}

            {#each activeSkinData.extraTables as extraTable, tableIdx (tableIdx)}
              {@render dataTable(
                {
                  skinName,
                  tableIdx: tableIdx + 1,
                  tableName: extraTable.name,
                  headers: extraTable.headers,
                  rows: extraTable.rows,
                  moneyColumns: extraTable.moneyColumns,
                  readOnlyColumns: extraTable.readOnlyColumns,
                  skinData: null,
                  cellFormulaTokens: extraTable.cellFormulaTokens,
                  formulaTokens: activeSkinData.skin.formulaTokens,
                  isPvp: activeSkinData.skin.isPvp,
                },
                false,
              )}
            {/each}
          {:else if towerStore.selectedSkinName === skinName}
            <div class="text-center py-4 text-muted-foreground">
              No skin data available.
            </div>
          {/if}
        </Tabs.Content>
      {/each}
    </Tabs.Root>

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
      border: 0;
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
    color: #44e500;
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
