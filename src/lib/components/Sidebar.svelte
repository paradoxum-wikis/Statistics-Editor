<script lang="ts">
    import UpgradeViewer from "./UpgradeViewer.svelte";
    import DetectionEditor from "./DetectionEditor.svelte";
    import { towerStore } from "$lib/stores/tower.svelte";
    import { imageLoader } from "$lib/services/imageLoader";
    import { untrack } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { settingsStore } from "$lib/stores/settings.svelte";

    let {
        class: className = "",
        settingsOpen = $bindable(false),
    }: {
        class?: string;
        settingsOpen?: boolean;
    } = $props();

    let upgradeImages = $state<{ [key: number]: string }>({});
    let upgradeNames = $state<{ [key: number]: string }>({});
    let selectedUpgrade = $state("0");
    let numUpgrades = $state(0);
    let loadingImages = $state(new SvelteMap<number, boolean>());

    $effect(() => {
        imageLoader.setDebugMode(settingsStore.debugMode);

        const tower = towerStore.selectedData;
        if (!tower) {
            untrack(() => {
                upgradeImages = {};
                upgradeNames = {};
                numUpgrades = 0;
                loadingImages = new SvelteMap();
                imageLoader.resetState();
            });
            return;
        }

        const cachedImages = imageLoader.getCachedImages(tower.name);

        untrack(() => {
            if (cachedImages) {
                upgradeImages = { ...cachedImages };
                if (settingsStore.debugMode) {
                    console.log(
                        `[Sidebar] Using cached images for ${tower.name}`,
                    );
                }
            } else {
                upgradeImages = {};
            }

            // reset upgrade selection when tower changes
            selectedUpgrade = "0";
            imageLoader.resetState();
            loadingImages = new SvelteMap();
        });

        const skin = tower.getSkin(towerStore.selectedSkinName);
        untrack(() => {
            if (skin?.upgrades) {
                numUpgrades = skin.upgrades.length;
                const names: { [key: number]: string } = {};
                skin.upgrades.forEach((upgrade, index) => {
                    if (upgrade.upgradeData?.Title) {
                        names[index] = upgrade.upgradeData.Title;
                    }
                });
                upgradeNames = names;
            } else {
                numUpgrades = 0;
                upgradeNames = {};
            }
        });
    });

    // loading upgrade images
    $effect(() => {
        const tower = towerStore.selectedData;
        const upgrade = selectedUpgrade;

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
    <div class="flex-1">
        <UpgradeViewer
            {upgradeImages}
            {upgradeNames}
            bind:selectedUpgrade
            {loadingImages}
            {numUpgrades}
        />
    </div>
    <DetectionEditor />
</aside>
