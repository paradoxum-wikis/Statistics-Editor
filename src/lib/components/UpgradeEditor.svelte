<script lang="ts">
  import { towerStore } from "$lib/stores/tower.svelte";
  import { imageLoader } from "$lib/services/imageLoader";
  import { getTargetSkins } from "$lib/utils/towah";
  import CollapsibleSide from "./smol/CollapsibleSide.svelte";
  import { Layers } from "@lucide/svelte";

  type UpgradeRow = { index: number; title: string; image: string };

  let open = $state(false);
  let skinData = $derived(
    towerStore.selectedData?.getSkin(towerStore.selectedSkinName),
  );

  let upgradeRows = $derived.by((): UpgradeRow[] => {
    towerStore.refreshTrigger;
    if (!skinData?.upgrades?.length) return [];
    return skinData.upgrades.map((upgrade: any, index: number) => ({
      index,
      title: upgrade.upgradeData?.Title ?? "",
      image: upgrade.upgradeData?.Image ?? "",
    }));
  });

  function updateTitle(index: number, value: string) {
    const tower = towerStore.selectedData;
    if (!tower) return;
    const currentSkin = tower.getSkin(towerStore.selectedSkinName);
    if (!currentSkin) return;

    for (const skin of getTargetSkins(tower, currentSkin)) {
      skin.upgrades[index].upgradeData.Title = value;
    }

    towerStore.markDirty();
  }

  function updateImage(index: number, value: string) {
    const tower = towerStore.selectedData;
    if (!tower) return;
    const currentSkin = tower.getSkin(towerStore.selectedSkinName);
    if (!currentSkin) return;

    for (const skin of getTargetSkins(tower, currentSkin)) {
      skin.upgrades[index].upgradeData.Image = value;
    }

    imageLoader.clearUpgradeImageCache(tower.name, index);
    towerStore.markDirty();
  }
</script>

<CollapsibleSide
  title="Upgrades"
  icon={Layers}
  bind:open
  isPvp={skinData?.isPvp ?? false}
>
  {#if upgradeRows.length > 0}
    <div class="grid gap-2">
      {#each upgradeRows as row (row.index)}
        <div
          class="border border-border rounded-[calc(var(--radius)-0.25rem)_0] overflow-hidden"
        >
          <div
            class="text-[0.68rem] font-semibold text-muted-foreground px-3.5 py-0.5 border-b border-border bg-secondary/30"
          >
            Upgrade {row.index + 1}
          </div>
          <div class="flex flex-col gap-1 p-1.5 bg-secondary/10">
            <div class="flex items-center gap-1.5">
              <span class="text-[0.65rem] text-muted-foreground w-10 shrink-0">
                Title
              </span>
              <input
                type="text"
                class="input input-compact placeholder:text-muted-foreground/40"
                placeholder="-"
                value={row.title}
                onchange={(e) => updateTitle(row.index, e.currentTarget.value)}
              />
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[0.65rem] text-muted-foreground w-10 shrink-0">
                Image
              </span>
              <input
                type="text"
                class="input input-compact placeholder:text-muted-foreground/40"
                placeholder="-"
                value={row.image}
                onchange={(e) => updateImage(row.index, e.currentTarget.value)}
              />
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if skinData}
    <p class="text-xs text-muted-foreground px-1">No upgrades defined.</p>
  {:else}
    <p class="text-xs text-muted-foreground px-1">
      Select a tower to edit upgrades.
    </p>
  {/if}
</CollapsibleSide>
