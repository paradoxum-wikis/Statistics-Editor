<script lang="ts">
    import { untrack } from "svelte";
    import { Tabs } from "bits-ui";
    import type Tower from "$lib/towerComponents/tower";
    import type SkinData from "$lib/towerComponents/skinData";
    import { settingsStore } from "$lib/stores/settings.svelte";

    let {
        tower = null,
        onSave = undefined,
        disabled = false,
    }: {
        tower: Tower | null;
        onSave?: () => void;
        disabled?: boolean;
    } = $props();

    let selectedSkinName = $state("Regular");
    let availableSkins = $derived(tower ? tower.skinNames : []);
    let updateTrigger = $state(0);

    $effect(() => {
        if (
            tower &&
            !availableSkins.includes(untrack(() => selectedSkinName))
        ) {
            selectedSkinName = availableSkins.includes("Regular")
                ? "Regular"
                : availableSkins[0] || "";
        }
    });

    function isEditableForSkin(skinData: SkinData, attr: string) {
        if (!skinData) return false;
        if (skinData.readOnlyAttributes.includes(attr)) return false;
        if (attr === "Cost") return true;
        return skinData.locator.hasLocation(attr);
    }

    function updateStatForSkin(
        skinData: SkinData,
        levelIndex: number,
        attribute: string,
        value: string,
    ) {
        if (!skinData || disabled) return;

        let parsedValue: any = value;
        if (value === "true") parsedValue = true;
        else if (value === "false") parsedValue = false;
        else if (!isNaN(Number(value)) && value.trim() !== "")
            parsedValue = Number(value);

        if (settingsStore.debugMode) {
            console.log(
                `[TowerEditor] updateStat: Level ${levelIndex}, ${attribute} = ${parsedValue}`,
            );
        }

        skinData.set(levelIndex, attribute, parsedValue);
        updateTrigger++;
        onSave?.();
    }

    function getDetection(
        skinData: SkinData,
        levelIndex: number,
        detectionType: "Hidden" | "Flying" | "Lead",
    ): boolean {
        if (!skinData) return false;
        return Boolean(skinData.levels.getCell(levelIndex, detectionType));
    }

    function updateDetection(
        skinData: SkinData,
        levelIndex: number,
        detectionType: "Hidden" | "Flying" | "Lead",
        checked: boolean,
    ) {
        if (!skinData || disabled) return;

        if (settingsStore.debugMode) {
            console.log(
                `[TowerEditor] updateDetection: Level ${levelIndex}, ${detectionType} = ${checked}`,
            );
        }

        skinData.setDetection(levelIndex, detectionType, checked);
        updateTrigger++;
        onSave?.();
    }
</script>

<div class="space-y-4">
    {#if tower}
        {#key updateTrigger}
            <Tabs.Root
                value={selectedSkinName}
                onValueChange={(v) => (selectedSkinName = v)}
                class="card"
            >
                <Tabs.List class="tabs-list">
                    {#each availableSkins as skinName}
                        <Tabs.Trigger value={skinName} class="tab-trigger">
                            {skinName}
                        </Tabs.Trigger>
                    {/each}
                </Tabs.List>

                {#each availableSkins as skinName}
                    <Tabs.Content value={skinName}>
                        {@const skinData = tower.getSkin(skinName)}
                        {@const levels = skinData ? skinData.levels.levels : []}
                        {@const headers =
                            skinData && skinData.headers.length > 0
                                ? skinData.headers
                                : skinData
                                  ? skinData.levels.attributes
                                  : []}
                        {@const upgrades = skinData?.upgrades ?? []}
                        {#if skinData}
                            <div class="table-container">
                                <table class="table">
                                    <thead class="table-head">
                                        <tr>
                                            {#each headers as header}
                                                <th
                                                    scope="col"
                                                    class={header === "Level"
                                                        ? "table-header-sticky"
                                                        : "table-header whitespace-nowrap"}
                                                >
                                                    {header}
                                                </th>
                                            {/each}
                                        </tr>
                                    </thead>
                                    <tbody class="table-body">
                                        {#each levels as level, index (index)}
                                            <tr class="table-row">
                                                {#each headers as header (header)}
                                                    {#if header === "Level"}
                                                        <td
                                                            class="table-cell-sticky"
                                                        >
                                                            {index}
                                                        </td>
                                                    {:else}
                                                        <td class="table-data">
                                                            {#if isEditableForSkin(skinData, header)}
                                                                <input
                                                                    type="text"
                                                                    class="table-input"
                                                                    value={level[
                                                                        header
                                                                    ] ?? ""}
                                                                    {disabled}
                                                                    onchange={(
                                                                        e,
                                                                    ) =>
                                                                        updateStatForSkin(
                                                                            skinData,
                                                                            index,
                                                                            header,
                                                                            e
                                                                                .currentTarget
                                                                                .value,
                                                                        )}
                                                                />
                                                            {:else}
                                                                <div
                                                                    class="table-cell-readonly"
                                                                >
                                                                    {level[
                                                                        header
                                                                    ] !==
                                                                        undefined &&
                                                                    level[
                                                                        header
                                                                    ] !== null
                                                                        ? typeof level[
                                                                              header
                                                                          ] ===
                                                                          "number"
                                                                            ? Number(
                                                                                  level[
                                                                                      header
                                                                                  ].toFixed(
                                                                                      2,
                                                                                  ),
                                                                              )
                                                                            : level[
                                                                                  header
                                                                              ]
                                                                        : "-"}
                                                                </div>
                                                            {/if}
                                                        </td>
                                                    {/if}
                                                {/each}
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>

                            <!-- Detections Table -->
                            <div class="table-container mt-8">
                                <h3 class="text-lg font-bold mb-2 px-4 pt-4">
                                    Detections
                                </h3>
                                <table class="table">
                                    <thead class="table-head">
                                        <tr>
                                            <th
                                                scope="col"
                                                class="table-header-sticky"
                                            >
                                                Level
                                            </th>
                                            <th
                                                scope="col"
                                                class="table-header text-center"
                                            >
                                                Hidden
                                            </th>
                                            <th
                                                scope="col"
                                                class="table-header text-center"
                                            >
                                                Flying
                                            </th>
                                            <th
                                                scope="col"
                                                class="table-header text-center"
                                            >
                                                Lead
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody class="table-body">
                                        {#each levels as _, index (index)}
                                            <tr class="table-row">
                                                <td class="table-cell-sticky">
                                                    {index}
                                                </td>
                                                <td
                                                    class="table-data text-center"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        class="detection-checkbox"
                                                        checked={getDetection(
                                                            skinData,
                                                            index,
                                                            "Hidden",
                                                        )}
                                                        {disabled}
                                                        onchange={(e) =>
                                                            updateDetection(
                                                                skinData,
                                                                index,
                                                                "Hidden",
                                                                e.currentTarget
                                                                    .checked,
                                                            )}
                                                    />
                                                </td>
                                                <td
                                                    class="table-data text-center"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        class="detection-checkbox"
                                                        checked={getDetection(
                                                            skinData,
                                                            index,
                                                            "Flying",
                                                        )}
                                                        {disabled}
                                                        onchange={(e) =>
                                                            updateDetection(
                                                                skinData,
                                                                index,
                                                                "Flying",
                                                                e.currentTarget
                                                                    .checked,
                                                            )}
                                                    />
                                                </td>
                                                <td
                                                    class="table-data text-center"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        class="detection-checkbox"
                                                        checked={getDetection(
                                                            skinData,
                                                            index,
                                                            "Lead",
                                                        )}
                                                        {disabled}
                                                        onchange={(e) =>
                                                            updateDetection(
                                                                skinData,
                                                                index,
                                                                "Lead",
                                                                e.currentTarget
                                                                    .checked,
                                                            )}
                                                    />
                                                </td>
                                            </tr>
                                        {:else}
                                            <tr>
                                                <td
                                                    colspan="4"
                                                    class="table-data text-center text-muted-foreground"
                                                >
                                                    No levels found
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>

                            <div class="text-xs text-body mt-2 px-4 pb-4">
                                * Gray cells are calculated or inherited values
                                that cannot be edited directly.
                            </div>
                        {:else}
                            <div class="text-center py-4 text-muted-foreground">
                                No skin data available for {skinName}
                            </div>
                        {/if}
                    </Tabs.Content>
                {/each}
            </Tabs.Root>
        {/key}
    {:else}
        <div class="text-center py-8 text-body">
            Select a tower to edit its skins.
        </div>
    {/if}
</div>
