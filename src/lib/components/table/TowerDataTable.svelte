<script lang="ts">
	import type { GlobalModifier } from "$lib/utils/globalModifier";
	import {
		cellDisplaySource,
		displayCellValue,
		expandHeaderDisplay,
		formulaSourceTip,
		getDeltaForCell,
		getEditableCellRawValue,
		isCellEditable,
		resolveRefContent,
		type RefTokenRegistry,
		type TableConfig,
		type TableRow,
	} from "$lib/towerTable";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import CellRefs from "./CellRefs.svelte";
	import TowerTableCell from "./TowerTableCell.svelte";
	import CellInspectorModal from "./CellInspectorModal.svelte";

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
		writeVar,
		writeArraySlot,
		writeCell,
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
		writeVar: (key: string, value: string) => void;
		writeArraySlot: (key: string, idx: number, value: string) => void;
		writeCell: (
			config: TableConfig,
			rowIdx: number,
			header: string,
			value: string,
		) => void;
	} = $props();

	let inspected = $state<{ rowIdx: number; header: string } | null>(null);
	let inspectOpen = $state(false);

	function openInspect(rowIdx: number, header: string) {
		inspected = { rowIdx, header };
		inspectOpen = true;
	}

	function closeInspect(open: boolean) {
		if (!open) inspected = null;
	}

	let hoveredCol = $state<number | null>(null);

	const fTokens = $derived(
		(config.skinData?.formulaTokens ?? config.formulaTokens ?? {}) as Record<
			string,
			string
		>,
	);

	const tableNameDisplay = $derived(
		expandHeaderDisplay(config.tableName, fTokens, config),
	);
	const headerDisplays = $derived(
		config.headers.map((h, i) =>
			expandHeaderDisplay(config.rawHeaders?.[i] || h, fTokens, config),
		),
	);

	function resolveContentFor(rowIdx: number, row: TableRow) {
		return (content: string) =>
			resolveRefContent(content, config, rowIdx, row, globalModifier);
	}
</script>

<div
	class="table-container {!isFirst
		? 'extra-table-container'
		: ''} {settingsStore.minTableWidth ? 'min-content' : ''}"
>
	<table class="table {settingsStore.minTableWidth ? 'min-content' : ''}">
		<thead class="table-head">
			{#if config.tableName}
				<tr>
					<th colspan={config.headers.length} class="table-name-header">
						<CellRefs
							value={tableNameDisplay}
							readOnly={true}
							tokens={fTokens}
							{getRefNum}
							resolveContent={resolveContentFor(0, displayRows[0] ?? {})}
							{refTokenRegistry}
						/>
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
						class:hovered-col={hoveredCol === hIdx}
						onmouseenter={() => (hoveredCol = hIdx)}
						onmouseleave={() => (hoveredCol = null)}
					>
						<CellRefs
							value={headerDisplays[hIdx] || header}
							readOnly={true}
							tokens={fTokens}
							{getRefNum}
							resolveContent={resolveContentFor(0, displayRows[0] ?? {})}
							{refTokenRegistry}
						/>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody class="table-body">
			{#each displayRows as row, rowIdx (rowIdx)}
				{@const resolveContent = resolveContentFor(rowIdx, row)}
				<tr class="table-row">
					{#each config.headers as header, hIdx (`${hIdx}:${header}`)}
						{#if header === "Level"}
							<td
								class="table-cell-sticky"
								class:hovered-col={hoveredCol === hIdx}
								onmouseenter={() => (hoveredCol = hIdx)}
								onmouseleave={() => (hoveredCol = null)}
							>
								{row[header] ?? rowIdx}
							</td>
						{:else}
							{@const editable = isCellEditable(config, header)}
							{@const wrap = config.wrapCells?.[rowIdx]?.[header] ?? ""}
							{@const rawValue = getEditableCellRawValue(
								config,
								rowIdx,
								header,
							)}
							{@const formulaSource = editable
								? null
								: formulaSourceTip(rawValue, fTokens)}
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
									: 'readonly-cell'} {formulaSource
									? 'has-formula-source'
									: ''} {settingsStore.hideCellWrapper
									? 'compact-cell'
									: 'spacious-cell'}"
								class:hovered-col={hoveredCol === hIdx}
								onmouseenter={() => (hoveredCol = hIdx)}
								onmouseleave={() => (hoveredCol = null)}
							>
								<TowerTableCell
									value={displayCellValue(
										globalModifier,
										header,
										cellDisplaySource(row[header], rawValue, fTokens),
										fTokens,
									)}
									{rawValue}
									{editable}
									{disabled}
									{wrap}
									readOnlyValue={!editable}
									{formulaSource}
									tokens={fTokens}
									{deltaInfo}
									{getRefNum}
									{resolveContent}
									{refTokenRegistry}
									commit={(value) => commit(config, rowIdx, header, value)}
									onInspect={!editable && formulaSource
										? () => openInspect(rowIdx, header)
										: undefined}
								/>
							</td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if inspected}
	{@const row = displayRows[inspected.rowIdx]}
	<CellInspectorModal
		bind:open={inspectOpen}
		onOpenChange={closeInspect}
		{config}
		rowIdx={inspected.rowIdx}
		header={inspected.header}
		displayRow={row ?? {}}
		{globalModifier}
		{disabled}
		commit={(header, value) => {
			if (inspected) commit(config, inspected.rowIdx, header, value);
		}}
		writeCell={(header, value) => {
			if (inspected) writeCell(config, inspected.rowIdx, header, value);
		}}
		{writeVar}
		{writeArraySlot}
		{getRefNum}
		{refTokenRegistry}
	/>
{/if}

<style>
	.table-container {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
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
		background: color-mix(in oklch, var(--secondary) 40%, transparent);
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
				background: var(--muted);

				.table-cell-sticky {
					background: linear-gradient(var(--muted), var(--muted)) var(--card);
				}
			}

			&:last-child {
				border-bottom: none;
			}
		}
	}

	tr.table-row:hover {
		background: var(--secondary);

		.table-cell-sticky {
			background: linear-gradient(var(--secondary), var(--secondary))
				var(--card);
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
		background: linear-gradient(var(--muted), var(--muted)) var(--card);
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

	.hovered-col {
		background: linear-gradient(var(--secondary), var(--secondary)) var(--card);
	}
</style>
