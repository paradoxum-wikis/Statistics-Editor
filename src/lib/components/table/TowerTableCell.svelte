<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import MoneyIcon from "$lib/assets/Income.png?enhanced";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { formatNumber } from "$lib/utils/format";
	import {
		formatDelta,
		type DeltaInfo,
		type RefTokenRegistry,
	} from "$lib/towerTable";
	import CellRefs from "./CellRefs.svelte";
	import Tip from "../smol/Tip.svelte";

	let {
		value,
		rawValue,
		editable,
		disabled,
		isMoney,
		readOnlyValue,
		formulaSource = null,
		tokens = {},
		deltaInfo,
		getRefNum,
		resolveContent,
		refTokenRegistry,
		commit,
	}: {
		value: string | number | null | undefined;
		rawValue: string | number | null | undefined;
		editable: boolean;
		disabled: boolean;
		isMoney: boolean;
		readOnlyValue: boolean;
		formulaSource?: string | null;
		tokens?: Record<string, string>;
		deltaInfo: DeltaInfo;
		getRefNum: (content: string, name?: string | null) => number;
		resolveContent?: (content: string) => string;
		refTokenRegistry?: RefTokenRegistry;
		commit: (value: string) => void;
	} = $props();

	let editing = $state(false);

	const editText = $derived(
		rawValue === undefined || rawValue === null
			? ""
			: typeof rawValue === "number"
				? formatNumber(rawValue)
				: String(rawValue),
	);

	const showFormulaTip = $derived(!editable && !!formulaSource);
	const focusOnMount: Attachment<HTMLElement> = (node) => node.focus();
</script>

{#snippet cellRefs(readOnly: boolean)}
	<CellRefs
		{value}
		{readOnly}
		{tokens}
		{getRefNum}
		{resolveContent}
		{refTokenRegistry}
	/>
{/snippet}

{#snippet body()}
	{#if isMoney}
		<enhanced:img
			src={MoneyIcon}
			alt=""
			class="money-icon {editable ? 'money-icon-input' : ''}"
		/>
	{/if}

	{#if editable}
		{#if editing}
			<input
				{@attach focusOnMount}
				type="text"
				size="1"
				class="table-input"
				value={editText}
				{disabled}
				onfocus={(e) => {
					e.currentTarget.dataset.original = e.currentTarget.value;
					if (settingsStore.clearOnEdit) e.currentTarget.value = "";
				}}
				onblur={(e) => {
					editing = false;
					const next = e.currentTarget.value;
					const original = e.currentTarget.dataset.original ?? "";
					if (next === "") {
						e.currentTarget.value = original;
					} else if (next !== original) {
						commit(next);
					}
				}}
				onkeydown={(e) => {
					if (e.key === "Enter") e.currentTarget.blur();
					if (e.key === "Escape") {
						e.currentTarget.value = e.currentTarget.dataset.original ?? "";
						editing = false;
					}
				}}
			/>
		{:else}
			<button
				type="button"
				class="cell-display"
				{disabled}
				onclick={() => {
					editing = true;
				}}
			>
				{@render cellRefs(true)}
			</button>
		{/if}
	{:else if isMoney}
		<span class="money-value">
			{@render cellRefs(readOnlyValue)}
		</span>
	{:else}
		<span class="cell-multiline">
			{@render cellRefs(readOnlyValue)}
		</span>
	{/if}

	{#if deltaInfo.delta !== null && deltaInfo.delta !== 0}
		<span class="delta-text {deltaInfo.className}">
			({formatDelta(deltaInfo.delta)})
		</span>
	{/if}
{/snippet}

{#if showFormulaTip}
	<Tip
		content={formulaSource!}
		class="max-w-80! font-mono text-xs!"
		sideOffset={6}
	>
		{#snippet children({ props })}
			{#if isMoney}
				<div class="cell-flex formula-tip" {...props}>
					{@render body()}
				</div>
			{:else}
				<span class="formula-tip" {...props}>
					{@render body()}
				</span>
			{/if}
		{/snippet}
	</Tip>
{:else if editable || isMoney}
	<div class="cell-flex">
		{@render body()}
	</div>
{:else}
	{@render body()}
{/if}

<style>
	.cell-flex {
		display: flex;
		align-items: flex-start;
		gap: 0.25rem;
		width: 100%;
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

	.cell-multiline {
		white-space: pre-line;
	}

	.formula-tip {
		cursor: help;
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

	.money-value {
		color: #44e500;
		text-shadow:
			0 0 0.09375em black,
			0 0 0.09375em black,
			0 0 0.09375em black,
			0 0 0.09375em black,
			0 0 0.09375em black;
	}
</style>
