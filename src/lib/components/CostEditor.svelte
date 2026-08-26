<script lang="ts">
	import { towerStore } from "$lib/stores/tower.svelte";
	import { getTargetSkins } from "$lib/utils/towah";
	import CollapsibleSide from "./smol/CollapsibleSide.svelte";
	import SubtleRow from "./smol/SubtleRow.svelte";
	import Tip from "./smol/Tip.svelte";
	import { CircleDollarSign } from "@lucide/svelte";
	import { parseNumeric, stripRefs } from "$lib/utils/format";
	import { getCostValue } from "$lib/neowtext/functions";
	import { mkCellKey } from "$lib/neowtext/directives";
	import type SkinData from "$lib/towerComponents/skinData";

	type CostRow = {
		level: number;
		label: string;
		cost: number;
	};

	let open = $state(true);
	let skinData = $derived(
		towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
	);

	let hasFncCost = $derived.by(() => {
		towerStore.refreshTrigger;
		return (
			skinData != null &&
			getCostValue(skinData.formulaTokens, skinData.variantPrefix) !== undefined
		);
	});

	function costAt(skin: SkinData, level: number): number {
		const num = parseNumeric(
			(getCostValue(skin.formulaTokens, skin.variantPrefix) || "")
				.split(";")
				[level]?.trim() || "0",
		);
		return Number.isNaN(num) ? 0 : num;
	}

	let costRows = $derived.by((): CostRow[] => {
		towerStore.refreshTrigger;
		if (!hasFncCost || !skinData?.formulaTokens) return [];

		const levels = skinData.levels?.levels ?? [];
		const upgrades = skinData.upgrades ?? [];
		const rows: CostRow[] = [];

		for (let i = 0; i < levels.length; i++) {
			const label =
				i === 0
					? "Base"
					: String(
							upgrades[i - 1]?.upgradeData?.Level != null
								? upgrades[i - 1].upgradeData.Level
								: i,
						);
			rows.push({ level: i, label, cost: costAt(skinData, i) });
		}

		return rows;
	});

	function updateCost(level: number, value: number) {
		const tower = towerStore.selectedData;
		if (!tower) return;
		const currentSkin = tower.getSkin(towerStore.selectedSkinName);
		if (!currentSkin) return;

		for (const skin of getTargetSkins(tower, currentSkin)) {
			const headers =
				skin.headers.length > 0 ? skin.headers : skin.levels.attributes;
			const totalHeader = headers.find((h) => {
				const n = stripRefs(h);
				return n === "Total Cost" || n === "Total Price";
			});
			if (totalHeader) {
				for (let i = level; i < skin.levels.levels.length; i++) {
					towerStore.captureBaselineCell(
						mkCellKey(skin.name, 0, i, totalHeader),
						skin.rawRows[i]?.[totalHeader] ??
							skin.levels.getCell(i, totalHeader),
					);
				}
			}
			skin.setCost(level, value);
		}

		towerStore.markDirty();
	}
</script>

{#if hasFncCost}
	<CollapsibleSide
		title="Costs"
		icon={CircleDollarSign}
		bind:open
		isPvp={skinData?.isPvp ?? false}
	>
		<div class="grid gap-1.5">
			{#each costRows as row (row.level)}
				<SubtleRow class="flex min-w-0 items-center px-1.5 py-1">
					<span
						class="w-16 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
						title={row.level === 0 ? "Base" : `Slot ${row.level}`}
					>
						<Tip content={row.level === 0 ? "Base" : `Slot ${row.level}`}>
							{#snippet children({ props })}
								<span
									class="inline-block max-w-full text-[0.7rem] text-muted-foreground"
									{...props}
								>
									{row.level === 0 ? row.label : `Upg. ${row.label}`}
								</span>
							{/snippet}
						</Tip>
					</span>
					<input
						type="number"
						class="input compact min-w-0"
						value={row.cost}
						min="0"
						step="1"
						onchange={(e) => {
							const val = parseInt(e.currentTarget.value);
							if (!isNaN(val) && val >= 0) updateCost(row.level, val);
						}}
					/>
				</SubtleRow>
			{/each}
		</div>
	</CollapsibleSide>
{/if}
