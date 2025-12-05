<script lang="ts">
    import UpgradeViewer from "./UpgradeViewer.svelte";

    let {
        upgradeImages,
        upgradeNames = {},
        selectedUpgrade = $bindable("0"),
        class: className = "",
        loadingImages,
        numUpgrades,
    }: {
        upgradeImages: { [key: number]: string };
        upgradeNames?: { [key: number]: string };
        selectedUpgrade: string;
        class?: string;
        loadingImages: Map<number, boolean>;
        numUpgrades: number;
    } = $props();
</script>

<aside
    class="bg-card border-r border-border p-4 overflow-y-auto h-full {className}"
>
    <UpgradeViewer
        {upgradeImages}
        {upgradeNames}
        bind:selectedUpgrade
        {loadingImages}
        {numUpgrades}
    />
</aside>
