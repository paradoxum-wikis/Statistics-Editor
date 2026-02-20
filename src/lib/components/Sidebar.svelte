<script lang="ts">
    import UpgradeViewer from "./UpgradeViewer.svelte";
    import UpgradeEditor from "./UpgradeEditor.svelte";
    import DetectionEditor from "./DetectionEditor.svelte";
    import CostEditor from "./CostEditor.svelte";
    import { Popover } from "bits-ui";
    import { towerStore } from "$lib/stores/tower.svelte";
    import { imageLoader } from "$lib/services/imageLoader";
    import { untrack } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { settingsStore } from "$lib/stores/settings.svelte";

    import Separator from "./Separator.svelte";
    import {
        House,
        Settings,
        Sun,
        Moon,
        SunMoon,
        Check,
    } from "@lucide/svelte";

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
        from?: string;
        to?: string;
        icon?: string;
    };

    let {
        class: className = "",
        settingsOpen = $bindable(false),
        onHome,
        showFooter = true,
    }: {
        class?: string;
        settingsOpen?: boolean;
        onHome?: () => void | Promise<void>;
        showFooter?: boolean;
    } = $props();

    let upgradeImages = $state<{ [key: number]: string }>({});
    let prevTowerRef: object | null = null;
    let upgradeNames = $state<{ [key: number]: string }>({});
    let upgradeSummaries = $state<{ [key: number]: SummaryLine[] }>({});
    let selectedUpgrade = $state("0");
    let numUpgrades = $state(0);
    let loadingImages = $state(new SvelteMap<number, boolean>());

    const STATS_BY_ICON: Array<[icon: string, stats: string[]]> = [
        [DamageIcon, ["Damage"]],
        [CooldownIcon, ["Cooldown", "Tick"]],
        [IncomeIcon, ["Income"]],
        [RangeIcon, ["Range"]],
        [HiddenIcon, ["Hidden"]],
        [FlyingIcon, ["Flying"]],
        [LeadIcon, ["Lead"]],
    ];

    const ICON_BY_STAT: Record<string, string> = Object.fromEntries(
        STATS_BY_ICON.flatMap(([icon, stats]) => stats.map((s) => [s, icon])),
    );

    const IGNORED_STATS = new Set([
        "Level",
        "Cost",
        "Total Price",
        "Price",
        "Cost Efficiency",
        "DPS",
        "Title",
        "Image",
    ]);

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

    function formatValue(v: unknown): string {
        if (v === undefined || v === null) return "-";
        if (typeof v === "number") {
            if (!Number.isFinite(v)) return String(v);
            const abs = Math.abs(v);
            if (abs >= 1000) return String(Number(v.toFixed(0)));
            if (abs >= 100) return String(Number(v.toFixed(2)));
            if (abs >= 1) return String(Number(v.toFixed(3)));
            if (abs >= 0.01) return String(Number(v.toFixed(4)));
            if (abs >= 0.0001) return String(Number(v.toFixed(6)));
            return v.toPrecision(6).replace(/\.?0+(e|$)/, "$1");
        }
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "string") return v;
        return JSON.stringify(v);
    }

    function buildUpgradeSummariesForeskin(
        skin: any,
    ): { [key: number]: SummaryLine[] } {
        const result: { [key: number]: SummaryLine[] } = {};
        if (!skin?.levels?.levels) return result;

        const levels = skin.levels.levels;
        const attributes: string[] =
            skin.headers && skin.headers.length > 0
                ? skin.headers
                : skin.levels.attributes ?? [];

        for (
            let upgradeIndex = 0;
            upgradeIndex < levels.length - 1;
            upgradeIndex++
        ) {
            const fromLevel = upgradeIndex;
            const toLevel = upgradeIndex + 1;
            const lines: SummaryLine[] = [];

            for (const stat of attributes) {
                if (IGNORED_STATS.has(stat)) continue;
                if (["Hidden", "Flying", "Lead"].includes(stat)) continue;

                const fromVal = skin.levels.getCell(fromLevel, stat);
                const toVal = skin.levels.getCell(toLevel, stat);

                const fromNorm = normalizeForCompare(fromVal);
                const toNorm = normalizeForCompare(toVal);

                if (fromNorm === toNorm) continue;
                if (!toNorm && !fromNorm) continue;

                lines.push({
                    kind: "change",
                    stat,
                    from: formatValue(fromVal),
                    to: formatValue(toVal),
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
        towerStore.effectiveWikitext;

        const tower = towerStore.selectedData;
        if (!tower) {
            untrack(() => {
                upgradeImages = {};
                upgradeNames = {};
                upgradeSummaries = {};
                numUpgrades = 0;
                loadingImages = new SvelteMap();
                imageLoader.resetState();
                prevTowerRef = null;
            });
            return;
        }

        const skin = tower.getSkin(towerStore.selectedSkinName);
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
            loadingImages = new SvelteMap();
        });

        untrack(() => {
            if (skin?.upgrades) {
                numUpgrades = skin.upgrades.length;
                const names: { [key: number]: string } = {};
                skin.upgrades.forEach((upgrade: any, index: number) => {
                    if (upgrade.upgradeData?.Title) {
                        names[index] = upgrade.upgradeData.Title;
                    }
                });
                upgradeNames = names;
                upgradeSummaries = buildUpgradeSummariesForeskin(skin);
            } else {
                numUpgrades = 0;
                upgradeNames = {};
                upgradeSummaries = {};
            }
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
        });

        imageLoader.loadImage(towerName, index, imageId).then((url) => {
            const currentTower = untrack(() => towerStore.selectedData);
            if (currentTower?.name !== towerName) return;

            untrack(() => {
                if (url) {
                    upgradeImages = { ...upgradeImages, [index]: url };
                }
                loadingImages.set(index, false);
            });
        });
    });
</script>

<aside class="sidebar-container {className}">
    <div class="sidebar-scroll">
        <UpgradeViewer
            {upgradeImages}
            {upgradeNames}
            {upgradeSummaries}
            bind:selectedUpgrade
            {loadingImages}
            {numUpgrades}
        />

        <UpgradeEditor />
        <DetectionEditor />
        <CostEditor />
    </div>

    {#if showFooter}
        <Separator />

        <div class="sidebar-bottom-bar">
            <button class="icon-btn" onclick={() => onHome?.()} title="Home">
                <House size={20} />
            </button>

            <Popover.Root>
                <Popover.Trigger class="icon-btn" title="Theme">
                    {#if settingsStore.theme === "light"}
                        <Sun size={20} />
                    {:else if settingsStore.theme === "dark"}
                        <Moon size={20} />
                    {:else}
                        <SunMoon size={20} />
                    {/if}
                </Popover.Trigger>
                <Popover.Content
                    class="popover-content w-auto! min-w-42"
                    sideOffset={8}
                    align="center"
                >
                    <h4 class="font-medium text-sm mb-1">Theme</h4>
                    <div class="grid gap-0.5">
                        <button
                            class="dropdown-item w-full justify-start!"
                            onclick={() => settingsStore.setTheme("light")}
                        >
                            <Sun class="mr-2 h-4 w-4" />
                            <span>Light</span>
                            {#if settingsStore.theme === "light"}
                                <Check class="ms-2 h-4 w-4" />
                            {/if}
                        </button>
                        <button
                            class="dropdown-item w-full justify-start!"
                            onclick={() => settingsStore.setTheme("dark")}
                        >
                            <Moon class="mr-2 h-4 w-4" />
                            <span>Dark</span>
                            {#if settingsStore.theme === "dark"}
                                <Check class="ms-2 h-4 w-4" />
                            {/if}
                        </button>
                        <button
                            class="dropdown-item w-full justify-start!"
                            onclick={() => settingsStore.setTheme("system")}
                        >
                            <SunMoon class="mr-2 h-4 w-4" />
                            <span>System</span>
                            {#if settingsStore.theme === "system"}
                                <Check class="ms-2 h-4 w-4" />
                            {/if}
                        </button>
                    </div>
                </Popover.Content>
            </Popover.Root>

            <button
                class="icon-btn"
                onclick={() => (settingsOpen = true)}
                title="Settings"
            >
                <Settings size={20} />
            </button>
        </div>
    {/if}
</aside>

<style>
    @reference "../../routes/layout.css";

    .sidebar-container {
        @apply bg-card border-r border-border h-full flex flex-col;
    }

    .sidebar-scroll {
        @apply flex-1 overflow-y-auto p-4 flex flex-col;
    }

    .sidebar-bottom-bar {
        @apply p-2 bg-card flex items-center justify-center gap-2;
    }
</style>
