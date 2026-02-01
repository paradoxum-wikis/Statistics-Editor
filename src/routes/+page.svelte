<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { towerStore } from "$lib/stores/tower.svelte";
    import { settingsStore } from "$lib/stores/settings.svelte";
    import { profileStore } from "$lib/stores/profile.svelte";

    import TowerEditor from "$lib/components/TowerEditor.svelte";
    import WikiEditor from "$lib/components/wiki/WikiEditor.svelte";
    import Introduction from "$lib/components/Introduction.svelte";
    import Sidebar from "$lib/components/Sidebar.svelte";
    import SettingsModal from "$lib/components/SettingsModal.svelte";

    import { Combobox, DropdownMenu, Popover, AlertDialog } from "bits-ui";
    import {
        Settings,
        Table,
        FileJson,
        Trash2,
        Check,
        Plus,
        ChevronsUpDown,
    } from "@lucide/svelte";

    type EditorMode = "cells" | "wiki";

    let isClient = $state(false);
    let isReady = $state(false);
    let settingsOpen = $state(false);

    let editorMode = $state<EditorMode>("cells");

    function openWikiEditor() {
        editorMode = "wiki";
    }

    function backToCells() {
        towerStore.forceReload();
        editorMode = "cells";
    }

    let searchValue = $state("");
    let comboboxOpen = $state(false);

    let items = $derived(
        towerStore.names.map((name) => ({
            value: name,
            label: name,
        })),
    );

    let filteredTowers = $derived(
        items.filter((item) =>
            item.label.toLowerCase().includes(searchValue.toLowerCase()),
        ),
    );

    // Initialization
    $effect(() => {
        if (isClient && !isReady) {
            const towerParam = $page.url.searchParams.get("tower");
            if (towerParam && towerStore.names.includes(towerParam)) {
                towerStore.load(towerParam);
                searchValue = towerParam;
            }
            isReady = true;
        }
    });

    onMount(async () => {
        isClient = true;
        profileStore.init();
        await towerStore.init(profileStore.current);
    });

    async function handleSelect(itemValue: string | undefined) {
        if (!itemValue) return;
        const success = await towerStore.load(itemValue);
        if (success) {
            searchValue = itemValue;
            const url = new URL(window.location.href);
            url.searchParams.set("tower", itemValue);
            await goto(url.toString(), { keepFocus: true, noScroll: true });
            comboboxOpen = false;
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
        if (name) {
            if (profileStore.create(name)) {
                towerStore.switchProfile(name);
            }
        }
    }

    let deleteProfileOpen = $state(false);
    let profileToDelete = $state<string | null>(null);

    function openDeleteProfileDialog(profile: string, e: Event) {
        e.stopPropagation();
        profileToDelete = profile;
        deleteProfileOpen = true;
    }

    function confirmDeleteProfile() {
        if (profileToDelete) {
            if (profileStore.delete(profileToDelete)) {
                if (profileStore.current === "Default") {
                    towerStore.switchProfile("Default");
                }
            }
            profileToDelete = null;
        }
        deleteProfileOpen = false;
    }
</script>

<div class="h-screen bg-background font-sans relative">
    <Sidebar class="absolute left-0 top-0 h-full w-[15%]" bind:settingsOpen />

    <!-- Main Content -->
    <div class="ml-[15%] flex flex-col h-full">
        <header
            class="border-b bg-card p-4 flex items-center justify-between sticky top-0 z-10"
        >
            <h1 class="text-heading text-xl font-bold ml-4">
                TDS Statistics Editor
            </h1>
            <div class="flex items-center space-x-4">
                {#if isClient}
                    <!-- Editor Mode Toggle -->
                    <div
                        class="flex bg-muted rounded-md p-1 border border-border mr-2"
                    >
                        <button
                            class="px-3 py-1 text-sm rounded-sm transition-colors {editorMode ===
                            'cells'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'}"
                            onclick={backToCells}
                        >
                            <div class="flex items-center gap-2">
                                <Table size={16} />
                                <span>Table</span>
                            </div>
                        </button>
                        <button
                            class="px-3 py-1 text-sm rounded-sm transition-colors {editorMode ===
                            'wiki'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'}"
                            onclick={openWikiEditor}
                        >
                            <div class="flex items-center gap-2">
                                <FileJson size={16} />
                                <span>Wiki</span>
                            </div>
                        </button>
                    </div>

                    <button
                        class="p-2 hover:bg-muted rounded-md transition-colors"
                        onclick={() => (settingsOpen = true)}
                        title="Settings"
                    >
                        <Settings size={20} />
                    </button>

                    <!-- Profile Selector -->
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger
                            class="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
                        >
                            <span>{profileStore.current}</span>
                            <span class="text-xs text-muted-foreground"
                                >(Profile)</span
                            >
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                            align="end"
                            class="z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                        >
                            <DropdownMenu.Group>
                                <DropdownMenu.GroupHeading
                                    class="px-2 py-1.5 text-sm font-semibold"
                                >
                                    Profiles
                                </DropdownMenu.GroupHeading>
                                {#each profileStore.list as profile (profile)}
                                    <DropdownMenu.Item
                                        onclick={() =>
                                            handleProfileChange(profile)}
                                        class="flex justify-between items-center group cursor-pointer px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
                                    >
                                        <span>{profile}</span>
                                        {#if profile === profileStore.current}
                                            <span class="ml-auto">✓</span>
                                        {:else if profile !== "Default"}
                                            <button
                                                class="ml-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onclick={(e) =>
                                                    openDeleteProfileDialog(
                                                        profile,
                                                        e,
                                                    )}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        {/if}
                                    </DropdownMenu.Item>
                                {/each}
                            </DropdownMenu.Group>
                            <DropdownMenu.Separator
                                class="-mx-1 my-1 h-px bg-muted"
                            />
                            <DropdownMenu.Item
                                onclick={handleCreateProfile}
                                class="cursor-pointer px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
                            >
                                <span>+ Create Profile</span>
                            </DropdownMenu.Item>
                            {#if profileStore.current !== "Default"}
                                <DropdownMenu.Item
                                    class="text-destructive focus:text-destructive cursor-pointer px-2 py-1.5 text-sm rounded-sm hover:bg-red-100"
                                    onclick={(e) =>
                                        openDeleteProfileDialog(
                                            profileStore.current,
                                            e,
                                        )}
                                >
                                    <span>Delete Current</span>
                                </DropdownMenu.Item>
                            {/if}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                {/if}

                <!-- Reset Button (Popover) -->
                {#if towerStore.selectedData}
                    <Popover.Root>
                        <Popover.Trigger
                            class="px-3 py-2 text-sm font-medium text-destructive border border-destructive/50 rounded-md hover:bg-destructive/10 transition-colors"
                        >
                            Reset Tower
                        </Popover.Trigger>
                        <Popover.Content
                            class="w-80 z-50 rounded-md border bg-popover p-4 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                        >
                            <div class="space-y-2">
                                <h4 class="font-medium leading-none">
                                    Confirm Reset
                                </h4>
                                <p class="text-sm text-muted-foreground">
                                    Are you sure you want to reset all changes
                                    for <span class="font-bold"
                                        >{towerStore.selectedName}</span
                                    >
                                    in profile
                                    <span class="font-bold"
                                        >{profileStore.current}</span
                                    >? This action cannot be undone.
                                </p>
                            </div>
                            <div class="flex justify-end mt-4 gap-2">
                                <Popover.Close
                                    class="px-3 py-1 text-sm border rounded-md hover:bg-accent"
                                >
                                    Cancel
                                </Popover.Close>
                                <Popover.Close
                                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md text-sm px-3 py-1 text-white"
                                    onclick={confirmReset}
                                >
                                    Confirm
                                </Popover.Close>
                            </div>
                        </Popover.Content>
                    </Popover.Root>
                {/if}

                <!-- Tower Selector (Combobox) -->
                {#if isClient}
                    <div class="flex items-center space-x-2">
                        <Combobox.Root
                            type="single"
                            items={filteredTowers}
                            bind:inputValue={searchValue}
                            bind:open={comboboxOpen}
                            onValueChange={(v) => handleSelect(v)}
                        >
                            <div class="relative">
                                <Combobox.Input
                                    placeholder="Select a tower..."
                                    class="h-10 w-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    onclick={() => (comboboxOpen = true)}
                                />
                                <ChevronsUpDown
                                    class="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none"
                                />
                            </div>

                            <Combobox.Portal>
                                <Combobox.Content
                                    class="z-50 min-w-[250px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                                >
                                    <Combobox.Viewport class="p-1">
                                        {#each filteredTowers as item, i (i + item.value)}
                                            <Combobox.Item
                                                class="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50"
                                                value={item.value}
                                                label={item.label}
                                            >
                                                {item.label}
                                                {#if searchValue === item.value}
                                                    <span
                                                        class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"
                                                    >
                                                        ✓
                                                    </span>
                                                {/if}
                                            </Combobox.Item>
                                        {:else}
                                            <span
                                                class="block px-4 py-2 text-sm text-muted-foreground"
                                            >
                                                No results found
                                            </span>
                                        {/each}
                                    </Combobox.Viewport>
                                </Combobox.Content>
                            </Combobox.Portal>
                        </Combobox.Root>
                    </div>
                {/if}
            </div>
        </header>

        <main class="flex-1 p-8 overflow-x-auto">
            {#if !isClient}
                <div class="card p-8 text-center">
                    <p class="animate-pulse text-body">Initializing...</p>
                </div>
            {:else if towerStore.selectedData}
                {#if editorMode === "cells"}
                    <TowerEditor
                        tower={towerStore.selectedData}
                        onSave={() => towerStore.save()}
                    />
                {:else}
                    <div class="space-y-3">
                        <WikiEditor
                            towerName={towerStore.selectedName}
                            open={true}
                        />
                    </div>
                {/if}
            {:else if towerStore.isLoading}
                <div class="card p-8 text-center">
                    <p class="animate-pulse text-body">Loading tower data...</p>
                </div>
            {:else}
                <Introduction />
            {/if}
        </main>
    </div>
</div>

<SettingsModal bind:open={settingsOpen} />

<!-- Delete Profile Confirmation -->
<AlertDialog.Root bind:open={deleteProfileOpen}>
    <AlertDialog.Portal>
        <AlertDialog.Overlay
            class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        />
        <AlertDialog.Content
            class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg"
        >
            <div class="flex flex-col space-y-2 text-center sm:text-left">
                <AlertDialog.Title class="text-lg font-semibold">
                    Are you absolutely sure?
                </AlertDialog.Title>
                <AlertDialog.Description class="text-sm text-muted-foreground">
                    This action cannot be undone. This will permanently delete
                    the profile
                    <span class="font-bold text-foreground"
                        >{profileToDelete}</span
                    >
                    and remove all data associated with it.
                </AlertDialog.Description>
            </div>
            <div
                class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"
            >
                <AlertDialog.Cancel
                    class="mt-2 sm:mt-0 px-4 py-2 border rounded-md hover:bg-accent"
                >
                    Cancel
                </AlertDialog.Cancel>
                <AlertDialog.Action
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-md"
                    onclick={confirmDeleteProfile}
                >
                    Delete
                </AlertDialog.Action>
            </div>
        </AlertDialog.Content>
    </AlertDialog.Portal>
</AlertDialog.Root>
