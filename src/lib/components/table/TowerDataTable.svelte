<script lang="ts">
  import { Tooltip } from "bits-ui";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { renderCellHtml } from "$lib/neowtext/render";
  import type { GlobalModifier } from "$lib/utils/globalModifier";
  import {
    displayCellValue,
    getCellRefs,
    getDeltaForCell,
    getRefsFromSources,
    isCellEditable,
    type RefTokenRegistry,
    type TableConfig,
    type TableRow,
  } from "$lib/towerTable";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import CellRefs from "./CellRefs.svelte";
  import RenderedHtml from "./RenderedHtml.svelte";
  import TowerTableCell from "./TowerTableCell.svelte";

  let {
    config,
    displayRows,
    compareRows,
    baseline,
    globalModifier,
    showDiff,
    disabled,
    isFirst,
    refTokenRegistry,
    getRefNum,
    commit,
  }: {
    config: TableConfig;
    displayRows: TableRow[];
    compareRows: TableRow[];
    baseline: Record<string, unknown>;
    globalModifier: GlobalModifier;
    showDiff: boolean;
    disabled: boolean;
    isFirst: boolean;
    refTokenRegistry: RefTokenRegistry;
    getRefNum: (content: string, name?: string | null) => number;
    commit: (
      config: TableConfig,
      rowIdx: number,
      header: string,
      value: string,
    ) => void;
  } = $props();

  const fTokens = $derived(
    (config.skinData?.formulaTokens ?? config.formulaTokens ?? {}) as Record<
      string,
      string
    >,
  );
</script>

<Tooltip.Provider delayDuration={150}>
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
              <RenderedHtml html={renderCellHtml(config.tableName, true)} />
            </th>
          </tr>
        {/if}
        <tr>
          {#each config.headers as header, hIdx (header)}
            <th
              scope="col"
              class={header === "Level"
                ? "table-header-sticky px-2"
                : "table-header whitespace-nowrap"}
            >
              <CellRefs
                value={header}
                readOnly={true}
                entries={getRefsFromSources(
                  config.rawHeaders?.[hIdx] || header,
                  "",
                  config,
                  0,
                  displayRows[0] ?? {},
                  globalModifier,
                  fTokens,
                  refTokenRegistry,
                )}
                {getRefNum}
              />
            </th>
          {/each}
        </tr>
      </thead>
      <tbody class="table-body">
        {#each displayRows as row, rowIdx (rowIdx)}
          <tr class="table-row">
            {#each config.headers as header, hIdx (`${hIdx}:${header}`)}
              {#if header === "Level"}
                <td class="table-cell-sticky">
                  {row[header] ?? rowIdx}
                </td>
              {:else}
                {@const editable = isCellEditable(config, header)}
                {@const isMoney = config.moneyColumns.includes(header)}
                {@const deltaInfo = showDiff
                  ? getDeltaForCell(
                      baseline,
                      compareRows[rowIdx]?.[header],
                      config.skinName,
                      config.tableIdx,
                      rowIdx,
                      header,
                      !editable,
                    )
                  : { delta: null, className: "", cellClass: "" }}
                <td
                  class="table-data {deltaInfo.cellClass} {editable
                    ? 'editable-cell'
                    : 'readonly-cell'} {settingsStore.hideCellWrapper
                    ? 'compact-cell'
                    : 'spacious-cell'}"
                >
                  <TowerTableCell
                    value={displayCellValue(
                      globalModifier,
                      header,
                      row[header],
                    )}
                    rawValue={config.rows[rowIdx]?.[header]}
                    {editable}
                    {disabled}
                    {isMoney}
                    readOnlyValue={!editable}
                    refs={getCellRefs(
                      header,
                      row[header],
                      config,
                      rowIdx,
                      displayRows[rowIdx],
                      globalModifier,
                      refTokenRegistry,
                    )}
                    {deltaInfo}
                    {getRefNum}
                    commit={(value) => commit(config, rowIdx, header, value)}
                  />
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Tooltip.Provider>

<style>
  @reference "../../../routes/layout.css";

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
    min-width: 100px;
    vertical-align: top;
  }

  .compact-cell {
    padding: 0.35rem;
  }

  .spacious-cell {
    padding: 0.5rem 1rem;
    min-width: 120px;
  }

  .readonly-cell {
    color: var(--muted-foreground);
    font-style: italic;
  }

  .diff-positive {
    background-color: color-mix(
      in oklch,
      transparent,
      oklch(0.6 0.12 145 / 0.16)
    ) !important;

    tr.table-row:hover & {
      background-color: color-mix(
        in oklch,
        transparent,
        oklch(0.6 0.12 145 / 0.22)
      ) !important;
    }
  }

  .diff-negative {
    background-color: color-mix(
      in oklch,
      transparent,
      oklch(0.58 0.14 25 / 0.16)
    ) !important;

    tr.table-row:hover & {
      background-color: color-mix(
        in oklch,
        transparent,
        oklch(0.58 0.14 25 / 0.22)
      ) !important;
    }
  }
</style>
