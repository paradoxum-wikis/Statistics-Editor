<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { SvelteMap } from "svelte/reactivity";
    import TowerEditor from "$lib/components/TowerEditor.svelte";
    import Introduction from "$lib/components/Introduction.svelte";
    import SettingsModal from "$lib/components/SettingsModal.svelte";
    import Sidebar from "$lib/components/Sidebar.svelte";
    import { Combobox, DropdownMenu, Popover, AlertDialog } from "bits-ui";
    import { towerStore } from "$lib/stores/tower.svelte";
    import { profileStore } from "$lib/stores/profile.svelte";
    import { settingsStore } from "$lib/stores/settings.svelte";
    import { imageLoader } from "$lib/services/imageLoader";

    let isClient = $state(false);
    let isReady = $state(false);
    let settingsOpen = $state(false);
    let searchValue = $state("");
    let upgradeImages = $state<{ [key: number]: string }>({});
    let upgradeNames = $state<{ [key: number]: string }>({});
    let selectedUpgrade = $state("0");
    let comboboxOpen = $state(false);
    let numUpgrades = $state(0);
    let loadingImages = $state(new SvelteMap<number, boolean>());

    let items = $derived(
        towerStore.names.map((name) => ({ value: name, label: name })),
    );

    let filteredTowers = $derived(
        searchValue === ""
            ? items
            : items.filter((tower) =>
                  tower.label.toLowerCase().includes(searchValue.toLowerCase()),
              ),
    );

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
                console.log(`Using cached images for ${tower.name}`);
            } else {
                upgradeImages = {};
            }

            // reset upgrade selection when tower changes
            selectedUpgrade = "0";
            imageLoader.resetState();
            loadingImages = new SvelteMap();
        });

        const skin = tower.getSkin(tower.skinNames[0]);
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

        const skin = tower.getSkin(tower.skinNames[0]);
        if (!skin?.upgrades?.[index]) return;

        const upgradeData = skin.upgrades[index];
        const imageId = upgradeData.upgradeData.Image;
        const towerName = tower.name;

        // idk if this should be how to avoid loops but whatever
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

    $effect(() => {
        if (!isReady) return;
        const towerParam = $page.url.searchParams.get("tower");

        untrack(() => {
            if (towerParam && towerParam !== towerStore.selectedName) {
                towerStore.load(towerParam);
            } else if (!towerParam && towerStore.selectedData) {
                towerStore.selectedData = null;
                towerStore.selectedName = "";
            }
        });
    });

    onMount(async () => {
        isClient = true;
        try {
            if (!window.state) {
                window.state = {
                    boosts: {
                        tower: {
                            RateOfFireBug: 0,
                            extraCooldown: 0,
                            firerateBuff: 0,
                            damageBuff: 0,
                            flatDamage: 0,
                            rangeBuff: 0,
                            discount: 0,
                        },
                        unit: {
                            RateOfFireBug: 0,
                            extraCooldown: 0,
                            firerateBuff: 0,
                            flatDamage: 0,
                            rangeBuff: 0,
                            healthBuff: 0,
                            spawnrateBuff: 0,
                        },
                    },
                    cache: {},
                };
            }

            profileStore.init();
            await towerStore.init(profileStore.current);
            isReady = true;
        } catch (error) {
            console.error("Failed to load TowerManager:", error);
        }
    });

    // combobox selection
    async function handleSelect(value: string) {
        if (!value) return;
        if (await towerStore.load(value)) {
            const url = new URL($page.url);
            url.searchParams.set("tower", value);
            goto(url.toString(), { keepFocus: true, noScroll: true });
        }
    }

    async function confirmReset() {
        if (towerStore.selectedData) {
            await towerStore.reset();
        }
    }

    async function handleProfileChange(newProfile: string) {
        if (profileStore.switch(newProfile)) {
            await towerStore.switchProfile(newProfile);
        }
    }

    function handleCreateProfile() {
        const name = prompt("Enter new profile name:");
        if (name && profileStore.create(name)) {
            towerStore.switchProfile(name);
        }
    }

    let deleteProfileOpen = $state(false);
    let profileToDelete = $state("");

    function openDeleteProfileDialog(name: string) {
        profileToDelete = name;
        deleteProfileOpen = true;
    }

    function confirmDeleteProfile() {
        if (profileToDelete && profileToDelete !== "Default") {
            if (profileStore.delete(profileToDelete)) {
                towerStore.switchProfile("Default");
            }
        }
        deleteProfileOpen = false;
    }
</script>

<div class="h-screen bg-background font-sans relative">
    <!-- Sidebar -->
    <Sidebar
        class="absolute left-0 top-0 h-full w-[15%]"
        {upgradeImages}
        {upgradeNames}
        bind:selectedUpgrade
        {numUpgrades}
        {loadingImages}
    />

    <!-- Main content -->
    <div class="ml-[15%] flex flex-col h-full">
        <!-- Top bar -->
        <header
            class="bg-card border-b border-border p-4 flex items-center justify-between"
        >
            <h1 class="text-heading">
                {towerStore.selectedData?.name || "No tower selected"}
            </h1>
            <div class="flex items-center space-x-4">
                {#if isClient}
                    <button
                        class="btn-secondary text-sm px-3 py-1"
                        onclick={() => (settingsOpen = true)}
                    >
                        Settings
                    </button>
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger
                            class="btn-secondary text-sm px-3 py-1 flex items-center gap-2"
                        >
                            Profile: {profileStore.current}
                            <span class="text-xs">▼</span>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                            class="z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                        >
                            <DropdownMenu.Group>
                                <DropdownMenu.GroupHeading
                                    class="px-2 py-1.5 text-sm font-semibold"
                                >
                                    Switch Profile
                                </DropdownMenu.GroupHeading>
                                {#each profileStore.list as profile}
                                    <DropdownMenu.Item
                                        class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                        onSelect={() =>
                                            handleProfileChange(profile)}
                                    >
                                        {profile}
                                        {#if profile === profileStore.current}
                                            <span class="ml-auto">✓</span>
                                        {/if}
                                    </DropdownMenu.Item>
                                {/each}
                            </DropdownMenu.Group>
                            <DropdownMenu.Separator
                                class="-mx-1 my-1 h-px bg-muted"
                            />
                            <DropdownMenu.Item
                                class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                onSelect={handleCreateProfile}
                            >
                                + Create New Profile
                            </DropdownMenu.Item>
                            {#if profileStore.current !== "Default"}
                                <DropdownMenu.Item
                                    class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-red-500 data-highlighted:bg-red-100 data-highlighted:text-red-600"
                                    onSelect={() =>
                                        openDeleteProfileDialog(
                                            profileStore.current,
                                        )}
                                >
                                    Delete Current Profile
                                </DropdownMenu.Item>
                            {/if}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                {/if}
                {#if towerStore.selectedData}
                    <Popover.Root>
                        <Popover.Trigger
                            class="btn-secondary text-sm px-3 py-1 text-red-500 disabled:opacity-50"
                            disabled={towerStore.isLoading}
                        >
                            Reset Tower
                        </Popover.Trigger>
                        <Popover.Content
                            class="z-50 w-80 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                            sideOffset={4}
                        >
                            <div class="space-y-2">
                                <h4 class="font-medium leading-none">
                                    Confirm Reset
                                </h4>
                                <p class="text-sm text-muted-foreground">
                                    Are you sure you want to reset {towerStore
                                        .selectedData.name} to default values?
                                </p>
                            </div>
                            <div class="flex justify-end mt-4 gap-2">
                                <Popover.Close
                                    class="btn-secondary text-sm px-3 py-1"
                                >
                                    Cancel
                                </Popover.Close>
                                <Popover.Close
                                    class="btn-secondary bg-red-600 text-white hover:bg-red-700 text-sm px-3 py-1"
                                    onclick={confirmReset}
                                >
                                    Reset
                                </Popover.Close>
                            </div>
                        </Popover.Content>
                    </Popover.Root>
                {/if}
                {#if isClient}
                    <div class="flex items-center space-x-2">
                        <Combobox.Root
                            type="single"
                            value={towerStore.selectedName}
                            onValueChange={(v) => {
                                towerStore.selectedName = v;
                                handleSelect(v);
                            }}
                            bind:open={comboboxOpen}
                            onOpenChangeComplete={(o) => {
                                if (!o) searchValue = "";
                            }}
                            items={filteredTowers}
                            disabled={towerStore.isLoading}
                        >
                            <div class="relative">
                                <Combobox.Input
                                    oninput={(e) =>
                                        (searchValue = e.currentTarget.value)}
                                    onfocus={() => (comboboxOpen = true)}
                                    class="input [&>span]:line-clamp-1"
                                    placeholder="Search towers..."
                                />
                            </div>
                            <Combobox.Portal>
                                <Combobox.Content
                                    class="relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                                >
                                    <Combobox.ScrollUpButton
                                        class="flex w-full items-center justify-center py-1"
                                    >
                                        ↑
                                    </Combobox.ScrollUpButton>
                                    <Combobox.Viewport class="p-1">
                                        {#each filteredTowers as item, i (i + item.value)}
                                            <Combobox.Item
                                                value={item.value}
                                                label={item.label}
                                                class="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                                            >
                                                {item.label}
                                            </Combobox.Item>
                                        {:else}
                                            <span
                                                class="block px-5 py-2 text-sm text-muted-foreground"
                                            >
                                                No towers found.
                                            </span>
                                        {/each}
                                    </Combobox.Viewport>
                                    <Combobox.ScrollDownButton
                                        class="flex w-full items-center justify-center py-1"
                                    >
                                        ↓
                                    </Combobox.ScrollDownButton>
                                </Combobox.Content>
                            </Combobox.Portal>
                        </Combobox.Root>
                    </div>
                {/if}
            </div>
        </header>

        <!-- Main area -->
        <main class="flex-1 p-8 overflow-x-auto">
            {#if !isClient}
                <div class="card p-8 text-center">
                    <p class="animate-pulse text-body">
                        Loading editor core...
                    </p>
                </div>
            {:else if towerStore.selectedData}
                <TowerEditor
                    tower={towerStore.selectedData}
                    onSave={() => towerStore.save()}
                    disabled={towerStore.isLoading}
                />
            {:else if towerStore.isLoading}
                <div class="card p-8 text-center">
                    <p class="animate-pulse text-body">Loading tower...</p>
                </div>
            {:else}
                <Introduction />
            {/if}
        </main>
    </div>

    <SettingsModal bind:open={settingsOpen} />

    <AlertDialog.Root bind:open={deleteProfileOpen}>
        <AlertDialog.Portal>
            <AlertDialog.Overlay
                class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            />
            <AlertDialog.Content
                class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg md:w-full"
            >
                <div class="flex flex-col space-y-2 text-center sm:text-left">
                    <AlertDialog.Title
                        class="text-lg font-semibold text-foreground"
                    >
                        Delete Profile
                    </AlertDialog.Title>
                    <AlertDialog.Description
                        class="text-sm text-muted-foreground"
                    >
                        Are you sure you want to delete profile "{profileToDelete}"?
                        This action cannot be undone and will remove all custom
                        data for this profile.
                    </AlertDialog.Description>
                </div>
                <div
                    class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"
                >
                    <AlertDialog.Cancel
                        class="mt-2 sm:mt-0 btn-secondary text-sm px-4 py-2"
                    >
                        Cancel
                    </AlertDialog.Cancel>
                    <AlertDialog.Action
                        class="btn-secondary bg-red-600 text-white hover:bg-red-700 text-sm px-4 py-2"
                        onclick={confirmDeleteProfile}
                    >
                        Delete
                    </AlertDialog.Action>
                </div>
            </AlertDialog.Content>
        </AlertDialog.Portal>
    </AlertDialog.Root>
</div>
