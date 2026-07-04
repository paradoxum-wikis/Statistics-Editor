<script lang="ts">
  import UpgradeViewer from "./UpgradeViewer.svelte";
  import UpgradeEditor from "./UpgradeEditor.svelte";
  import DetectionEditor from "./DetectionEditor.svelte";
  import CostEditor from "./CostEditor.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { imageLoader } from "$lib/services/imageLoader";
  import { untrack } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { applyRofBug, toNumericValue, getRofBugVer } from "$lib/utils/format";

  import DamageIcon from "$lib/assets/Damage.png";
  import CooldownIcon from "$lib/assets/Cooldown.png";
  import IncomeIcon from "$lib/assets/Income.png";
  import RangeIcon from "$lib/assets/Range.png";
  import HiddenIcon from "$lib/assets/HiddenDetection.png";
  import FlyingIcon from "$lib/assets/FlyingDetection.png";
  import LeadIcon from "$lib/assets/LeadDetection.png";

  type SummaryLine = {
    kind: "change" | "grant";
    stat: string;
    from?: string | number | null;
    to?: string | number | null;
    icon?: string;
  };

  let { class: className = "" }: { class?: string } = $props();

  let upgradeImages = $state<{ [key: number]: string }>({});
  let prevTowerRef: object | null = null;
  let selectedUpgrade = $state("0");
  let loadingImages = new SvelteMap<number, boolean>();
  let failedImages = new SvelteSet<number>();

  let currentSkin = $derived(
    towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
  );
  let numUpgrades = $derived(currentSkin?.upgrades?.length ?? 0);

  let upgradeNames = $derived.by(() => {
    if (!currentSkin?.upgrades) return {};
    const names: { [key: number]: string } = {};
    currentSkin.upgrades.forEach((upgrade: any, index: number) => {
      if (upgrade.upgradeData?.Title) {
        names[index] = upgrade.upgradeData.Title;
      }
    });
    return names;
  });

  let upgradeLevels = $derived.by(() => {
    if (!currentSkin?.upgrades) return [];
    return currentSkin.upgrades.map((upgrade: any, index: number) =>
      upgrade.upgradeData?.Level != null
        ? String(upgrade.upgradeData.Level)
        : String(index + 1),
    );
  });

  let upgradeSummaries = $derived.by(() => {
    if (!currentSkin) return {};
    return buildUpgradeSummariesForeskin(currentSkin);
  });

  const STATS_BY_ICON: Array<[icon: string, stats: string[]]> = [
    [DamageIcon, ["Damage"]],
    [CooldownIcon, ["Cooldown", "Tick", "Firerate"]],
    [IncomeIcon, ["Income"]],
    [RangeIcon, ["Range"]],
    [HiddenIcon, ["Hidden"]],
    [FlyingIcon, ["Flying"]],
    [LeadIcon, ["Lead"]],
  ];

  const ICON_BY_STAT: Record<string, string> = Object.fromEntries(
    STATS_BY_ICON.flatMap(([icon, stats]) => stats.map((s) => [s, icon])),
  );

  function normalizeForCompare(v: unknown): string {
    if (v === undefined || v === null) return "";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return String(v);
      return String(Number(v.toFixed(8)));
    }
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return v.trim();
    return JSON.stringify(v);
  }

  function buildUpgradeSummariesForeskin(skin: any): {
    [key: number]: SummaryLine[];
  } {
    const result: { [key: number]: SummaryLine[] } = {};
    if (!skin?.levels?.levels) return result;

    const attributes: string[] = skin.levels.attributes ?? [];
    const excludedSummaryStats = new Set(["Level", "Cost"]);

    const parseLevelLabel = (
      value: unknown,
    ): { numeric: number | null; suffix: string } => {
      const raw = String(value ?? "").trim();
      const match = raw.match(/^(\d+)([A-Za-z]*)$/);
      if (!match) return { numeric: null, suffix: "" };
      return {
        numeric: Number.parseInt(match[1], 10),
        suffix: (match[2] ?? "").toUpperCase(),
      };
    };

    const upgradeLevelLabels: string[] = (skin.upgrades ?? []).map(
      (upgrade: any, index: number) =>
        String(upgrade?.upgradeData?.Level ?? index + 1),
    );

    function resolveFromLevel(upgradeIndex: number): number {
      const current = parseLevelLabel(upgradeLevelLabels[upgradeIndex]);
      if (current.numeric == null) {
        return upgradeIndex > 0 ? upgradeIndex : 0;
      }

      let parentUpgradeIndex = -1;

      for (let i = upgradeIndex - 1; i >= 0; i--) {
        const prev = parseLevelLabel(upgradeLevelLabels[i]);
        if (prev.numeric == null || prev.numeric >= current.numeric) continue;
        if ((prev.suffix || "") === current.suffix) {
          parentUpgradeIndex = i;
          break;
        }
      }

      if (parentUpgradeIndex === -1 && current.suffix) {
        for (let i = upgradeIndex - 1; i >= 0; i--) {
          const prev = parseLevelLabel(upgradeLevelLabels[i]);
          if (prev.numeric == null || prev.numeric >= current.numeric) continue;
          if (!prev.suffix) {
            parentUpgradeIndex = i;
            break;
          }
        }
      }

      if (parentUpgradeIndex === -1 && upgradeIndex > 0) {
        parentUpgradeIndex = upgradeIndex - 1;
      }

      return parentUpgradeIndex === -1 ? 0 : parentUpgradeIndex + 1;
    }

    const rofInfo = getRofBugVer(skin?.formulaTokens);
    const rofCols = new Set(rofInfo.cols);

    const extraReadOnly =
      skin.extraTables?.flatMap((t: any) => t.readOnlyColumns || []) ?? [];
    const allReadOnly = new Set([
      ...(skin.readOnlyAttributes || []),
      ...extraReadOnly,
    ]);

    for (
      let upgradeIndex = 0;
      upgradeIndex < skin.upgrades.length;
      upgradeIndex++
    ) {
      const toLevel = upgradeIndex + 1;
      const fromLevel = resolveFromLevel(upgradeIndex);

      const lines: SummaryLine[] = [];

      for (const stat of attributes) {
        if (["Hidden", "Flying", "Lead"].includes(stat)) continue;
        if (excludedSummaryStats.has(stat)) continue;
        if (allReadOnly.has(stat)) continue;

        const fromVal = skin.levels.getCell(fromLevel, stat);
        const toVal = skin.levels.getCell(toLevel, stat);

        let cmpFrom: unknown = fromVal;
        let cmpTo: unknown = toVal;
        let displayFrom: unknown = fromVal;
        let displayTo: unknown = toVal;

        if (settingsStore.rofBug && rofCols.has(stat)) {
          const fnum = toNumericValue(fromVal);
          const tnum = toNumericValue(toVal);
          if (fnum !== null) {
            const adj = applyRofBug(fnum, rofInfo.type);
            cmpFrom = adj;
            displayFrom = adj;
          }

          if (tnum !== null) {
            const adj = applyRofBug(tnum, rofInfo.type);
            cmpTo = adj;
            displayTo = adj;
          }
        }

        const fromNorm = normalizeForCompare(cmpFrom);
        const toNorm = normalizeForCompare(cmpTo);

        if (fromNorm === toNorm) continue;
        if (!toNorm && !fromNorm) continue;

        lines.push({
          kind: "change",
          stat,
          from: displayFrom as string | number | null,
          to: displayTo as string | number | null,
          icon: ICON_BY_STAT[stat],
        });
      }

      for (const detection of ["Hidden", "Flying", "Lead"]) {
        const fromDet = !!skin.levels.getCell(fromLevel, detection);
        const toDet = !!skin.levels.getCell(toLevel, detection);
        if (!fromDet && toDet) {
          lines.push({
            kind: "grant",
            stat: detection,
            icon: ICON_BY_STAT[detection],
          });
        }
      }

      result[upgradeIndex] = lines;
    }

    return result;
  }

  $effect(() => {
    imageLoader.setDebugMode(settingsStore.debugMode);
    settingsStore.rofBug;
    towerStore.refreshTrigger;

    const tower = towerStore.selectedData;
    if (!tower) {
      untrack(() => {
        upgradeImages = {};
        loadingImages.clear();
        failedImages.clear();
        imageLoader.resetState();
        prevTowerRef = null;
      });
      return;
    }

    const towerChanged = tower !== prevTowerRef;
    if (towerChanged) {
      imageLoader.clearTowerImageCache(tower.name);
      prevTowerRef = tower;
    }

    const cachedImages = imageLoader.getCachedImages(tower.name);

    untrack(() => {
      upgradeImages = cachedImages ? { ...cachedImages } : {};

      if (settingsStore.debugMode && cachedImages) {
        console.log(`[Sidebar] Using cached images for ${tower.name}`);
      }

      if (towerChanged) {
        selectedUpgrade = "0";
      }
      imageLoader.resetState();
      loadingImages.clear();
      failedImages.clear();
    });
  });

  // loading upgrade images
  $effect(() => {
    const tower = towerStore.selectedData;
    const upgrade = selectedUpgrade;
    towerStore.refreshTrigger;

    if (!tower) return;

    const index = parseInt(upgrade);
    if (isNaN(index)) return;

    const skin = tower.getSkin(towerStore.selectedSkinName);
    if (!skin?.upgrades?.[index]) return;

    const upgradeData = skin.upgrades[index];
    const imageId = upgradeData.upgradeData.Image;
    const towerName = tower.name;

    // check prevent duplicate calls
    const hasImage = untrack(() => upgradeImages[index]);
    const isCurrentlyLoading = imageLoader.isLoading(index);
    const hasFailed = imageLoader.hasFailed(towerName, index);

    if (!imageId || hasImage || isCurrentlyLoading || hasFailed) return;

    untrack(() => {
      loadingImages.set(index, true);
      failedImages.delete(index);
    });

    imageLoader.loadImage(towerName, index, imageId).then((url) => {
      const currentTower = untrack(() => towerStore.selectedData);
      if (currentTower?.name !== towerName) return;

      untrack(() => {
        if (url) {
          upgradeImages = { ...upgradeImages, [index]: url };
          failedImages.delete(index);
        } else {
          failedImages.add(index);
        }
        loadingImages.set(index, false);
      });
    });
  });
</script>

<aside class="flex h-full flex-col border-r border-border bg-card {className}">
  <div class="flex flex-1 flex-col overflow-y-auto p-3.5">
    <UpgradeViewer
      {upgradeImages}
      {upgradeNames}
      {upgradeSummaries}
      {upgradeLevels}
      bind:selectedUpgrade
      {loadingImages}
      {failedImages}
      {numUpgrades}
    />

    <UpgradeEditor />
    <DetectionEditor />
    <CostEditor />
  </div>
</aside>
