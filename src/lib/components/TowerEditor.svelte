<script lang="ts">
  import { Tabs, Popover } from "bits-ui";
  import Separator from "./smol/Separator.svelte";
  import Btn from "./smol/Btn.svelte";
  import type Tower from "$lib/towerComponents/tower";
  import type SkinData from "$lib/towerComponents/skinData";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { modifierStore } from "$lib/stores/modifier.svelte";
  import { noFetchTowers } from "$lib/services/fetchTowerWiki";
  import { createShare, sharePageUrl } from "$lib/services/shareTower";
  import { toast } from "$lib/toast";
  import { isCustomTower } from "$lib/towerComponents/customTowers";
  import { mkCellKey, stripSeDiff } from "$lib/neowtext/directives";
  import {
    getRofBugVer,
    syncRefOnlyCellToken,
    stripRefs,
    toDisplayNumber,
  } from "$lib/utils/format";
  import TowerDataTable from "./table/TowerDataTable.svelte";
  import {
    buildActiveSkinTables,
    buildCompareRowsCache,
    buildDisplayRowsCache,
    buildSkinRefState,
    getCompareValueForKey as getCompareValueFromCache,
    refEntryKey,
    rebuildBaselineForSkin,
    tableCacheKey,
    type TableConfig,
  } from "$lib/towerTable";
  import NotesSection from "./NotesSection.svelte";
  import MemosSection from "./MemosSection.svelte";

  let {
    tower = null,
    disabled = false,
  }: {
    tower: Tower | null;
    disabled?: boolean;
  } = $props();

  const availableSkins = $derived(tower?.skinNames ?? []);
  const selectedSkinName = $derived(towerStore.selectedSkinName);

  const rofInfo = $derived.by(() => {
    settingsStore.rofBug;
    const info = getRofBugVer(tower?.getSkin(selectedSkinName)?.formulaTokens);
    return {
      type: info.type,
      cols: new Set(info.cols),
      enabled: settingsStore.rofBug,
    };
  });

  const activeSkinData = $derived.by(() => {
    towerStore.refreshTrigger;
    return buildActiveSkinTables(tower, selectedSkinName);
  });

  const modifier = $derived({ entries: modifierStore.entries });

  const compareRowsCache = $derived.by(() => {
    towerStore.refreshTrigger;
    modifierStore.entries;
    return buildCompareRowsCache(tower, rofInfo, modifier);
  });

  const displayRowsCache = $derived.by(() => {
    towerStore.refreshTrigger;
    modifierStore.entries;
    settingsStore.rofBug;
    return buildDisplayRowsCache(
      activeSkinData,
      selectedSkinName,
      rofInfo,
      modifier,
    );
  });

  const skinRefs = $derived.by(() => {
    towerStore.refreshTrigger;
    modifierStore.entries;
    return buildSkinRefState(activeSkinData, displayRowsCache, modifier);
  });

  const getSkinRefNum = $derived.by(() => {
    const map = skinRefs.refNumberMap;
    return (content: string, name?: string | null) =>
      map.get(refEntryKey(content, name)) ?? 1;
  });

  let showDiff = $state(settingsStore.seeValueDifference);
  let isFetching = $state(false);
  let shareOpen = $state(false);
  let isSharing = $state(false);
  let shareLink = $state<string | null>(null);
  let shareError = $state<string | null>(null);

  function setBaselineForSkin(t: Tower, skinName: string) {
    if (settingsStore.debugMode) {
      console.log(
        `[TowerEditor] Rebuilding baseline for ${t.name} (skin: ${skinName})`,
      );
    }
    towerStore.baseline = rebuildBaselineForSkin(
      t,
      skinName,
      rofInfo,
      modifier,
    );
    towerStore.baselineTowerId = t.name;
    towerStore.baselineSkinName = skinName;
    towerStore.baselineLocked = false;
  }

  function parseEditValue(value: string): string | number | boolean {
    if (value === "true") return true;
    if (value === "false") return false;
    return value.trim() !== "" && !isNaN(Number(value)) ? Number(value) : value;
  }

  function updateStatForSkin(
    skinData: SkinData,
    levelIndex: number,
    attribute: string,
    value: string,
  ) {
    if (disabled) return;
    const parsedValue = parseEditValue(value);
    if (settingsStore.debugMode) {
      console.log(
        `[TowerEditor] updateStat: Level ${levelIndex}, ${attribute} = ${parsedValue}`,
      );
    }
    skinData.set(levelIndex, attribute, parsedValue);
    towerStore.markDirty();
  }

  function updateRowStat(
    skinData: SkinData,
    extraTableIndex: number,
    rowIdx: number,
    header: string,
    value: string,
  ) {
    if (disabled) return;
    const extraTable = skinData.extraTables?.[extraTableIndex];
    const row = extraTable?.rows?.[rowIdx];
    if (!row) return;

    const parsedValue = parseEditValue(value);
    const formulaToken =
      extraTable?.cellFormulaTokens?.[String(rowIdx)]?.[header];
    if (typeof formulaToken === "string" && typeof parsedValue !== "boolean") {
      const synced = syncRefOnlyCellToken(
        formulaToken,
        parsedValue,
        skinData.formulaTokens,
        settingsStore.restoreRefOnClearEdit,
      );
      if (synced) {
        extraTable.cellFormulaTokens![String(rowIdx)][header] = synced;
      }
    }

    row[header] = parsedValue as string | number;

    const level = skinData.upgradeLevelForExtraTableCell(
      extraTableIndex,
      rowIdx,
    );
    if (level != null) {
      const upgradeStats = skinData.data?.Upgrades?.[level - 1]?.Stats;
      if (upgradeStats && typeof upgradeStats === "object")
        upgradeStats[header] = parsedValue;
      skinData.set(level, header, parsedValue);
    } else {
      skinData.refreshDerivedData();
    }

    towerStore.markDirty();
  }

  function captureBaselineIfMissing(
    config: TableConfig,
    rowIdx: number,
    header: string,
  ) {
    const key = mkCellKey(config.skinName, config.tableIdx, rowIdx, header);
    if (key in towerStore.baseline) return;
    const row = compareRowsCache.get(
      tableCacheKey(config.skinName, config.tableIdx),
    )?.[rowIdx];
    if (row)
      towerStore.captureBaselineCell(
        key,
        header === "Level" ? rowIdx : row[header],
      );
  }

  function commitEdit(
    config: TableConfig,
    rowIdx: number,
    header: string,
    value: string,
  ) {
    captureBaselineIfMissing(config, rowIdx, header);
    if (config.skinData) {
      updateStatForSkin(config.skinData, rowIdx, header, value);
      return;
    }

    const skin = activeSkinData?.skin;
    const extraTableIndex = config.sourceExtraTableIndex ?? -1;
    if (skin && extraTableIndex >= 0)
      updateRowStat(skin, extraTableIndex, rowIdx, header, value);
  }

  async function handleDiscard() {
    if (settingsStore.debugMode) {
      console.log(
        `[TowerEditor] Discard requested (tower=${tower?.name ?? "null"}, skin=${selectedSkinName})`,
      );
    }
    await towerStore.discardChanges();
    if (tower && selectedSkinName && !towerStore.baselineLocked)
      setBaselineForSkin(tower, selectedSkinName);
    towerStore.refresh();
  }

  function handleClearDiff() {
    if (settingsStore.debugMode) {
      console.log(
        `[TowerEditor] Clear diff requested (tower=${tower?.name ?? "null"}, skin=${selectedSkinName})`,
      );
    }
    towerStore.clearDiff();
    towerStore.refresh();
  }

  function getCompareValueForKey(key: string): string | number | undefined {
    return getCompareValueFromCache(compareRowsCache, key);
  }

  function collectChangedBaseline(): Record<string, unknown> {
    if (!tower) return {};
    const out: Record<string, unknown> = {};
    for (const [key, baseVal] of Object.entries(towerStore.baseline)) {
      const current = getCompareValueForKey(key);
      const baseN = toDisplayNumber(baseVal, false);
      const currentN = toDisplayNumber(current, false);
      if (baseN == null || currentN == null) continue;
      if (Math.abs(currentN - baseN) >= 1e-9) out[key] = baseVal;
    }
    return out;
  }

  function handleSave() {
    towerStore.save(collectChangedBaseline());
  }

  function resetShareState() {
    shareLink = null;
    shareError = null;
  }

  async function handleShare() {
    if (!tower || isSharing) return;
    isSharing = true;
    shareError = null;
    shareLink = null;
    try {
      const neowtext = towerStore.buildShareNeowtext(collectChangedBaseline());
      if (!neowtext?.trim()) {
        shareError = "Nothing to share for this tower.";
        return;
      }
      const id = await createShare(neowtext, tower.name);
      shareLink = sharePageUrl(id);
    } catch (e) {
      shareError = e instanceof Error ? e.message : "Share failed.";
    } finally {
      isSharing = false;
    }
  }

  function onShareOpenChange(open: boolean) {
    if (!open) resetShareState();
    else if (!shareLink && !shareError && !isSharing) void handleShare();
  }

  async function copyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy link, sorry...");
    }
  }

  async function handleFetchWiki() {
    if (!tower) return;

    isFetching = true;
    try {
      const { fetchTowerWiki } = await import("$lib/services/fetchTowerWiki");
      const { setWikiOverride } = await import("$lib/neowtext/wikiSource");
      const { profileStore } = await import("$lib/stores/profile.svelte");
      const wikitext = await fetchTowerWiki(tower.name, true);
      if (wikitext) {
        setWikiOverride(profileStore.current, tower.name, wikitext);
        towerStore.isDirty = false;
        await towerStore.forceReload();

        const refreshed = towerStore.selectedData;
        const skin = towerStore.selectedSkinName;
        if (refreshed && skin && !towerStore.baselineLocked)
          setBaselineForSkin(refreshed, skin);
      } else {
        alert("Failed to fetch wikitext from the Wiki.");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching from Wiki.");
    } finally {
      isFetching = false;
    }
  }

  const hasDiffData = $derived.by(() => {
    compareRowsCache;
    if (!tower || Object.keys(towerStore.baseline).length === 0) return false;
    for (const [key, baseVal] of Object.entries(towerStore.baseline)) {
      const current = getCompareValueForKey(key);
      const baseN = toDisplayNumber(baseVal, false);
      const currentN = toDisplayNumber(current, false);
      if (baseN == null || currentN == null) continue;
      if (Math.abs(currentN - baseN) >= 1e-9) return true;
    }
    return false;
  });

  const hasSavedDiff = $derived.by(() => {
    const text =
      towerStore.originalWikitext || towerStore.effectiveWikitext || "";
    return stripSeDiff(text) !== text;
  });
</script>

<div class="space-y-4">
  {#if tower}
    {#if towerStore.sharePreviewId}
      <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)_0] border border-sky-500/30 bg-sky-500/10 px-3 py-2"
      >
        <p class="text-sm text-sky-950 dark:text-sky-100">
          You are viewing a shared tower, your data stays unchanged until you
          explicitly apply.
        </p>
        <Btn
          variant="outline"
          size="sm"
          onclick={() => void towerStore.exitSharePreview()}
        >
          Back to My Stats
        </Btn>
      </div>
    {/if}
    <Tabs.Root
      value={towerStore.selectedSkinName}
      onValueChange={(v) => (towerStore.selectedSkinName = v)}
    >
      <Tabs.List
        class="mb-4 flex gap-2 rounded-[var(--radius)_0] bg-muted p-1 px-2"
      >
        {#each availableSkins as skinName (skinName)}
          <Tabs.Trigger
            value={skinName}
            class="rounded-[calc(var(--radius)-0.25rem)_0] border border-input bg-card px-4 py-1 text-sm font-medium text-foreground transition-colors duration-250 hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-white"
            >{skinName}</Tabs.Trigger
          >
        {/each}
      </Tabs.List>

      <Tabs.Content value={selectedSkinName}>
        {#if activeSkinData}
          {#each activeSkinData.orderedTables as table, orderedIdx (tableCacheKey(table.skinName, table.tableIdx))}
            <TowerDataTable
              config={table}
              displayRows={displayRowsCache.get(
                tableCacheKey(table.skinName, table.tableIdx),
              ) ?? []}
              compareRows={compareRowsCache.get(
                tableCacheKey(table.skinName, table.tableIdx),
              ) ?? []}
              baseline={towerStore.baseline}
              globalModifier={modifier}
              {showDiff}
              {disabled}
              isFirst={orderedIdx === 0}
              refTokenRegistry={skinRefs.registry}
              getRefNum={getSkinRefNum}
              commit={commitEdit}
            />
          {/each}
        {:else}
          <div class="text-center py-4 text-muted-foreground">
            No skin data available.
          </div>
        {/if}
      </Tabs.Content>
    </Tabs.Root>

    <Separator class="mt-4" />
    <div class="tower-editor-actions flex justify-end gap-2">
      <Popover.Root bind:open={shareOpen} onOpenChange={onShareOpenChange}>
        <Popover.Trigger
          class="btn btn-secondary"
          title="Create a short link to share this tower's stats"
        >
          <span class="max-md:hidden">Share URL</span>
          <span class="hidden max-md:inline">Share</span>
        </Popover.Trigger>
        <Popover.Content class="popover-content w-80">
          <div class="space-y-3">
            <p class="text-sm text-muted-foreground">
              Share this lovely tower with a short link! Anyone who opens it can
              view these stats in the editor.
            </p>
            {#if isSharing}
              <p class="text-sm text-muted-foreground">Creating link…</p>
            {:else if shareError}
              <p class="text-sm text-destructive">{shareError}</p>
              <div class="flex justify-end">
                <Popover.Close class="btn btn-outline btn-sm"
                  >Close</Popover.Close
                >
              </div>
            {:else if shareLink}
              <input
                class="input input-sm w-full font-mono text-xs"
                readonly
                value={shareLink}
                onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
              />
              <div class="flex justify-end gap-2">
                <Popover.Close class="btn btn-outline btn-sm"
                  >Close</Popover.Close
                >
                <Btn size="sm" onclick={copyShareLink}>Copy</Btn>
              </div>
            {/if}
          </div>
        </Popover.Content>
      </Popover.Root>
      {#if tower && !noFetchTowers.has(tower.name) && !isCustomTower(tower.name)}
        <Popover.Root>
          <Popover.Trigger class="btn btn-secondary" disabled={isFetching}>
            {#if isFetching}
              Fetching…
            {:else}
              <span class="max-md:hidden">Fetch Latest Data</span>
              <span class="hidden max-md:inline">Fetch Latest</span>
            {/if}
          </Popover.Trigger>
          <Popover.Content class="popover-content">
            <div class="space-y-2">
              <h4 class="font-medium leading-none">Confirm Fetch</h4>
              <p class="text-sm text-muted-foreground">
                Are you sure you want to replace your current data with the
                latest from Tower Defense Simulator Wiki? This will overwrite
                your local changes.
              </p>
            </div>
            <div class="flex justify-end mt-4 gap-2">
              <Popover.Close class="btn btn-outline">Cancel</Popover.Close>
              <Popover.Close class="btn btn-primary" onclick={handleFetchWiki}>
                Confirm
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Root>
      {/if}
      <Btn
        variant={showDiff ? "primary" : "secondary"}
        onclick={() => (showDiff = !showDiff)}
        disabled={!hasDiffData}
        title={hasDiffData
          ? showDiff
            ? "Hide value differences"
            : "Show value differences"
          : "No differences to display"}
      >
        <span class="inline-flex items-center gap-1.5">
          <span class="max-md:hidden"
            >{showDiff ? "Hide Difference" : "View Difference"}</span
          >
          <span class="hidden max-md:inline"
            >{showDiff ? "Hide Diff" : "View Diff"}</span
          >
        </span>
      </Btn>
      <Btn
        variant="secondary"
        onclick={towerStore.isDirty
          ? () => void handleDiscard()
          : handleClearDiff}
        disabled={!(towerStore.isDirty || hasSavedDiff)}
        title={towerStore.isDirty
          ? "Discard unsaved changes (revert to last loaded effective wiki)"
          : "Clear the saved @se-diff baseline (removes the difference tracking comment without leaving an empty line)"}
      >
        {#if towerStore.isDirty}
          <span class="max-md:hidden">Clear Changes</span>
          <span class="hidden max-md:inline">Clear</span>
        {:else}
          <span class="max-md:hidden">Clear Difference</span>
          <span class="hidden max-md:inline">Clear</span>
        {/if}
      </Btn>
      {#if towerStore.sharePreviewId}
        <Popover.Root>
          <Popover.Trigger
            class="btn btn-primary tower-editor-actions-primary"
            disabled={!towerStore.isDirty}
            title="Write these stats to your current profile"
          >
            <span class="max-md:hidden">Apply to Profile</span>
            <span class="hidden max-md:inline">Apply</span>
          </Popover.Trigger>
          <Popover.Content class="popover-content">
            <div class="space-y-2">
              <h4 class="font-medium leading-none">Apply to Profile?</h4>
              <p class="text-sm text-muted-foreground">
                This saves the shared stats (and any edits you've made) to your
                profile for this tower, replacing your existing tower in this
                profile.
              </p>
            </div>
            <div class="flex justify-end mt-4 gap-2">
              <Popover.Close class="btn btn-outline">Cancel</Popover.Close>
              <Popover.Close class="btn btn-primary" onclick={handleSave}>
                Confirm
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Root>
      {:else}
        <Btn
          variant="primary"
          class="tower-editor-actions-primary"
          onclick={handleSave}
          disabled={!towerStore.isDirty}
        >
          <span class="max-md:hidden">Save Changes</span>
          <span class="hidden max-md:inline">Save</span>
        </Btn>
      {/if}
    </div>

    <MemosSection />
    <NotesSection notes={skinRefs.notes} />
  {:else}
    <div class="text-center py-8 text-muted-foreground">
      Select a tower to edit its skins.
    </div>
  {/if}
</div>

<style>
  .tower-editor-actions {
    @media (width < 48rem) {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.375rem;

      :global(.btn) {
        width: 100%;
        height: 2rem;
        padding: 0 1rem;
        font-size: 0.75rem;
      }

      :global(.tower-editor-actions-primary) {
        grid-column: 1 / -1;
      }
    }
  }
</style>
