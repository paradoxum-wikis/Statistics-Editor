<script lang="ts">
	import {
		cellDisplaySource,
		displayCellValue,
		extractRefEntries,
		getEditableCellRawValue,
		isCellEditable,
		resolveRefContent,
		type RefTokenRegistry,
		type TableConfig,
		type TableRow,
	} from "$lib/towerTable";
	import { formatCellHold, inspectCell, levelValFor } from "$lib/cellInspect";
	import { renderCellHtml } from "$lib/neowtext/render";
	import type { GlobalModifier } from "$lib/utils/globalModifier";
	import { stripRefs } from "$lib/utils/format";
	import Modal from "../smol/Modal.svelte";
	import Separator from "../smol/Separator.svelte";
	import RenderedHtml from "./RenderedHtml.svelte";
	import TowerTableCell from "./TowerTableCell.svelte";

	let {
		open = $bindable(false),
		config,
		rowIdx,
		header,
		displayRow,
		globalModifier,
		disabled = false,
		commit,
		writeVar,
		writeArraySlot,
		writeCell,
		getRefNum,
		refTokenRegistry,
	}: {
		open?: boolean;
		config: TableConfig;
		rowIdx: number;
		header: string;
		displayRow: TableRow;
		globalModifier: GlobalModifier;
		disabled?: boolean;
		commit: (header: string, value: string) => void;
		writeVar: (key: string, value: string) => void;
		writeArraySlot: (key: string, idx: number, value: string) => void;
		writeCell: (header: string, value: string) => void;
		getRefNum: (content: string, name?: string | null) => number;
		refTokenRegistry?: RefTokenRegistry;
	} = $props();

	const fTokens = $derived(
		(config.skinData?.formulaTokens ?? config.formulaTokens ?? {}) as Record<
			string,
			string
		>,
	);
	const rawValue = $derived(getEditableCellRawValue(config, rowIdx, header));
	const levelVal = $derived(
		levelValFor(displayRow, rowIdx, config.branchSuffix),
	);
	const rowLevels = $derived(
		config.rows.map((r, i) => {
			const n = Number(r.Level);
			return Number.isFinite(n) ? n : i;
		}),
	);
	const columnRaws = $derived(
		config.rows.map((_, i) => {
			const v = getEditableCellRawValue(config, i, header);
			return typeof v === "string" ? v : "";
		}),
	);
	const wrap = $derived(config.wrapCells?.[rowIdx]?.[header] ?? "");
	const hasRecursion = $derived(
		config.recursionCells?.[rowIdx]?.includes(header) === true,
	);
	const recursionOnly = $derived(
		config.recursionOnlyCells?.[rowIdx]?.includes(header) === true,
	);
	const recToken = $derived(config.recursionTokens?.[rowIdx]?.[header] ?? "");
	const inspection = $derived(
		inspectCell(
			recursionOnly ? recToken : rawValue,
			fTokens,
			config.headers,
			levelVal,
			config.variantPrefix,
			{
				columnRaws,
				rowLevels,
				branchSuffix: config.branchSuffix,
			},
		),
	);
	const displayValue = $derived(
		displayCellValue(
			globalModifier,
			header,
			cellDisplaySource(displayRow[header], rawValue, fTokens),
			fTokens,
		),
	);
	const arrays = $derived(
		(inspection?.vars ?? []).filter((v) => v.kind === "array" && v.parts),
	);
	const scalars = $derived(
		(inspection?.vars ?? []).filter((v) => v.kind === "scalar"),
	);
	const inputs = $derived(
		(inspection?.inputs ?? []).filter(
			(h) => isCellEditable(config, h) && stripRefs(h) !== stripRefs(header),
		),
	);
	const formulas = $derived(
		(inspection?.vars ?? []).filter(
			(v) => v.kind === "formula" || v.kind === "ref",
		),
	);
	const cellHold = $derived(
		config.wikiCells?.[rowIdx]?.[header] ??
			formatCellHold(
				rawValue,
				wrap || null,
				hasRecursion,
				recursionOnly,
				recToken,
			),
	);
	const refs = $derived(
		extractRefEntries(
			recursionOnly ? "" : typeof rawValue === "string" ? rawValue : "",
			"",
			fTokens,
			refTokenRegistry,
		),
	);

	function varLabel(token: string, pin?: string) {
		return pin ? `${token.slice(0, -1)}${pin}$` : token;
	}

	function resolveContent(content: string) {
		return resolveRefContent(
			content,
			config,
			rowIdx,
			displayRow,
			globalModifier,
		);
	}

	function inputRaw(h: string): string {
		const v = getEditableCellRawValue(config, rowIdx, h);
		return v == null ? "" : String(v);
	}

	const noDelta = { delta: null, className: "", cellClass: "" };
</script>

<Modal bind:open title="Inspector">
	<div class="inspect">
		<div class="inspect-meta">
			<table>
				<thead>
					<tr>
						<th scope="col">Column</th>
						<th scope="col">Level</th>
						<th scope="col">Rendered</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>{stripRefs(header)}</td>
						<td>{displayRow.Level ?? rowIdx}</td>
						<td>
							<TowerTableCell
								value={displayValue}
								{rawValue}
								editable={false}
								{disabled}
								{wrap}
								readOnlyValue={true}
								tokens={fTokens}
								deltaInfo={noDelta}
								{getRefNum}
								{resolveContent}
								{refTokenRegistry}
								commit={() => {}}
							/>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		{#if refs.length}
			<div class="inspect-refs">
				{#each refs as ref (ref.name ?? ref.content)}
					<p class="inspect-ref">
						<RenderedHtml html={renderCellHtml(ref.content, true)} />
					</p>
				{/each}
			</div>
		{/if}

		<Separator />

		<div class="inspect-fields">
			<label class="inspect-row">
				<span class="inspect-label">Cell</span>
				<input
					class="input compact min-w-0 font-mono"
					value={cellHold}
					{disabled}
					onchange={(e) => writeCell(header, e.currentTarget.value)}
				/>
			</label>
			{#if arrays.length || scalars.length || inputs.length || formulas.length}
				{#each formulas as v (v.token)}
					<label class="inspect-row">
						<span class="inspect-label" title={v.token}>{v.token}</span>
						<input
							class="input compact min-w-0 font-mono"
							value={v.kind === "ref" ? v.def : stripRefs(v.def)}
							{disabled}
							onchange={(e) => writeVar(v.token, e.currentTarget.value)}
						/>
					</label>
				{/each}

				{#each scalars as v (v.token)}
					<label class="inspect-row">
						<span class="inspect-label" title={v.token}>{v.token}</span>
						<input
							class="input compact min-w-0"
							inputmode="decimal"
							value={stripRefs(v.def)}
							{disabled}
							onchange={(e) => writeVar(v.token, e.currentTarget.value)}
						/>
					</label>
				{/each}

				{#each arrays as v (v.token)}
					<div class="inspect-group">{varLabel(v.token, v.pin)}</div>
					{#each v.parts ?? [] as part, i (`${v.token}:${i}`)}
						{@const mute =
							v.used?.some(Boolean) && v.used[i] === false && i !== v.slot}
						<label
							class={[
								"inspect-row",
								i === v.slot && "current",
								mute && "foreign",
							]}
						>
							<span
								class="inspect-label"
								title={v.slotLabels?.[i] ?? String(i)}
							>
								{v.slotLabels?.[i] ?? i}
							</span>
							<input
								class="input compact min-w-0"
								inputmode="decimal"
								value={part}
								{disabled}
								onchange={(e) =>
									writeArraySlot(v.token, i, e.currentTarget.value)}
							/>
						</label>
					{/each}
				{/each}

				{#each inputs as input (input)}
					<label class="inspect-row">
						<span class="inspect-label" title={input}>{input}</span>
						<input
							class="input compact min-w-0"
							value={inputRaw(input)}
							{disabled}
							onchange={(e) => commit(input, e.currentTarget.value)}
						/>
					</label>
				{/each}
			{/if}
		</div>
	</div>
</Modal>

<style>
	.inspect {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: min(70dvh, 28rem);
		overflow-y: auto;
		padding-bottom: 0.25rem;
	}

	.inspect-meta {
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--card);

		table {
			width: 100%;
			table-layout: fixed;
			border-collapse: collapse;
		}

		th,
		td {
			padding: 4px 8px;
			text-align: left;
			vertical-align: middle;
			border-right: 1px solid var(--border);

			&:last-child {
				border-right: none;
			}
		}

		th {
			width: 22%;
			font-size: 0.7rem;
			font-weight: 700;
			color: var(--muted-foreground);
			background: var(--muted);

			&:last-child {
				width: 56%;
			}
		}

		td {
			font-size: 0.875rem;
			font-weight: 600;

			&:last-child {
				font-weight: 400;
				font-style: italic;
				color: var(--muted-foreground);
			}
		}

		thead tr {
			border-bottom: 1px solid var(--border);
		}
	}

	.inspect-refs {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.inspect-ref {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--muted-foreground);
	}

	.inspect-fields {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.inspect-group {
		padding: 2px 2px 0;
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--muted-foreground);
	}

	.inspect-row {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--card);

		&.current {
			background: var(--secondary);

			.inspect-label {
				font-weight: 600;
				color: var(--foreground);
			}
		}

		&.foreign {
			opacity: 0.5;
		}
	}

	.inspect-label {
		width: 6.5rem;
		flex-shrink: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.7rem;
		color: var(--muted-foreground);
	}
</style>
