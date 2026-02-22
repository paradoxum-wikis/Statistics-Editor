<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { cubicOut } from "svelte/easing";
    import { fly, fade } from "svelte/transition";

    import { towerStore } from "$lib/stores/tower.svelte";
    import { profileStore } from "$lib/stores/profile.svelte";
    import { settingsStore } from "$lib/stores/settings.svelte";

    import Sidebar from "./Sidebar.svelte";
    import TowerEditor from "./TowerEditor.svelte";
    import WikiEditor from "./WikiEditor.svelte";
    import Introduction from "./Introduction.svelte";
    import SettingsModal from "./SettingsModal.svelte";

    import { Combobox, DropdownMenu, Popover, AlertDialog, Dialog } from "bits-ui";
    import {
        Table,
        FileBraces,
        ChevronsUpDown,
        Check,
        Trash2,
        X,
        PanelLeft,
        User,
        Wrench,
        House,
        Settings,
        Sun,
        Moon,
        SunMoon,
        RotateCcw,
    } from "@lucide/svelte";

    let { isClient }: { isClient: boolean } = $props();

    type EditorMode = "cells" | "wiki";

    let editorMode = $state<EditorMode>("cells");
    let sidebarOpen = $state(false);
    let settingsOpen = $state(false);

    let searchValue = $state("");
    let comboboxOpen = $state(false);

    let items = $derived(
        towerStore.names.map((name) => ({ value: name, label: name })),
    );

    let filteredTowers = $derived(
        searchValue === ""
            ? items
            : items.filter((item) =>
                  item.label.toLowerCase().includes(searchValue.toLowerCase()),
              ),
    );

    async function goHome() {
        sidebarOpen = false;
        const url = new URL(page.url);
        const hadTowerParam = url.searchParams.has("tower");
        towerStore.unload();

        if (hadTowerParam) url.searchParams.delete("tower");
        editorMode = "cells";
        await goto(url, { keepFocus: true, noScroll: true });
    }

    async function handleSelect(itemValue: string | undefined) {
        if (!itemValue) return;
        const success = await towerStore.load(itemValue);
        if (success) {
            searchValue = "";
            const url = new URL(page.url);
            url.searchParams.set("tower", itemValue);
            await goto(url, { keepFocus: true, noScroll: true });
            comboboxOpen = false;
        }
    }

    async function confirmReset() {
        await towerStore.reset();
    }

    async function handleProfileChange(newProfile: string) {
        if (profileStore.switch(newProfile)) {
            await towerStore.switchProfile(newProfile);
            searchValue = "";
        }
    }

    let createProfileOpen = $state(false);
    let newProfileName = $state("");

    function openCreateProfileDialog() {
        newProfileName = "";
    }

    async function confirmCreateProfile() {
        const name = newProfileName.trim();
        if (!name) return;
        if (profileStore.create(name)) {
            await towerStore.switchProfile(name);
            newProfileName = "";
            createProfileOpen = false;
        }
    }

    function handleCreateProfileInputKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            void confirmCreateProfile();
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

<div class="mobile-root">
    <!-- Sidebar Scrim -->
    {#if sidebarOpen}
        <div
            class="settings-overlay"
            role="presentation"
            onclick={() => (sidebarOpen = false)}
            transition:fade={{ duration: 200 }}
        ></div>
    {/if}

    <!-- Sidebar Overlay -->
    <div
        class="fixed inset-y-0 left-0 z-51 w-72 transition-transform duration-200 {sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'}"
    >
        <Sidebar showFooter={false} class="h-full" />
    </div>

    <!-- Header -->
    <header class="mobile-header">
        <h1 class="text-sm font-bold text-foreground tracking-wide">
            {towerStore.selectedName || "TDS Statistics Editor"}
        </h1>

        {#if isClient}
            <Combobox.Root
                type="single"
                items={items}
                value={towerStore.selectedName}
                bind:open={comboboxOpen}
                onValueChange={(v) => handleSelect(v)}
                onOpenChange={(open) => {
                    if (!open) searchValue = "";
                }}
            >
                <div class="relative">
                    <Combobox.Input
                        placeholder="Select a tower..."
                        class="combobox-input w-[90dvw]!"
                        oninput={(e) => {
                            searchValue = e.currentTarget.value;
                            comboboxOpen = true;
                        }}
                        onclick={() => (comboboxOpen = true)}
                    />
                    <Combobox.Trigger class="absolute right-3 top-3">
                        <ChevronsUpDown class="h-4 w-4 opacity-50" />
                    </Combobox.Trigger>
                </div>

                <Combobox.Portal>
                    <Combobox.Content class="combobox-content">
                        <Combobox.Viewport class="p-2 max-h-75 overflow-y-auto">
                            {#each filteredTowers as item (item.value)}
                                <Combobox.Item
                                    class="combobox-item"
                                    value={item.value}
                                    label={item.label}
                                >
                                    {#snippet children({ selected })}
                                        {item.label}
                                        {#if selected}
                                            <span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                                                <Check class="h-4 w-4" />
                                            </span>
                                        {/if}
                                    {/snippet}
                                </Combobox.Item>
                            {:else}
                                <span class="block px-4 py-2 text-sm text-muted-foreground">
                                    No results found
                                </span>
                            {/each}
                        </Combobox.Viewport>
                    </Combobox.Content>
                </Combobox.Portal>
            </Combobox.Root>

            <div class="mode-toggle-group">
                <button
                    class="mode-toggle-btn {editorMode === 'cells' ? 'active' : 'inactive'}"
                    onclick={() => { editorMode = "cells"; towerStore.forceReload(); }}
                >
                    <div class="flex items-center gap-2">
                        <Table size={16} />
                        <span>Visual</span>
                    </div>
                </button>
                <button
                    class="mode-toggle-btn {editorMode === 'wiki' ? 'active' : 'inactive'}"
                    onclick={() => (editorMode = "wiki")}
                >
                    <div class="flex items-center gap-2">
                        <FileBraces size={16} />
                        <span>Source</span>
                    </div>
                </button>
            </div>
        {/if}
    </header>

    <!-- Main Content -->
    <main class="mobile-main">
        {#key `${isClient}-${towerStore.isLoading}-${towerStore.selectedName ?? ""}-${editorMode}`}
            <div in:fly={{ y: 8, duration: 160, easing: cubicOut }}>
                {#if !isClient}
                    <div class="card p-8 text-center">
                        <p class="animate-pulse text-body">
                            Engineer is setting up the editor for you...
                        </p>
                    </div>
                {:else if towerStore.selectedData}
                    {#if editorMode === "cells"}
                        <TowerEditor tower={towerStore.selectedData} />
                    {:else}
                        <WikiEditor towerName={towerStore.selectedName} open={true} />
                    {/if}
                {:else if towerStore.isLoading}
                    <div class="card p-8 text-center">
                        <p class="animate-pulse text-body">
                            Commander is getting this tower's files ready...
                        </p>
                    </div>
                {:else}
                    <Introduction />
                {/if}
            </div>
        {/key}
    </main>

    <!-- Bottom Bar -->
    <div class="bottom-bar">
        <!-- Sidebar Toggle -->
        <button
            class="icon-btn"
            onclick={() => (sidebarOpen = !sidebarOpen)}
            title="Toggle Sidebar"
            aria-label="Toggle sidebar"
        >
            <PanelLeft size={20} />
        </button>

        <!-- Profile -->
        <DropdownMenu.Root>
            <DropdownMenu.Trigger class="icon-btn" title="Profile" aria-label="Profile">
                <User size={20} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="center" side="top" class="dropdown-content">
                <DropdownMenu.Group>
                    <DropdownMenu.GroupHeading class="px-2 py-1.5 text-sm font-semibold">
                        Profiles
                    </DropdownMenu.GroupHeading>
                    {#each profileStore.list as profile (profile)}
                        <DropdownMenu.Item
                            onclick={() => handleProfileChange(profile)}
                            class="dropdown-item"
                        >
                            <span>{profile}</span>
                            {#if profile === profileStore.current}
                                <span class="ms-auto"><Check size={14} /></span>
                            {:else if profile !== "Default"}
                                <button
                                    class="ms-2 text-muted-foreground hover:text-destructive opacity-0 transition-opacity"
                                    onclick={(e) => openDeleteProfileDialog(profile, e)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            {/if}
                        </DropdownMenu.Item>
                    {/each}
                </DropdownMenu.Group>
                <DropdownMenu.Separator class="-mx-1 my-1 h-px bg-muted" />

                <Dialog.Root bind:open={createProfileOpen}>
                    <Dialog.Trigger
                        class="dropdown-item w-full text-left"
                        onclick={openCreateProfileDialog}
                    >
                        <span>+ Create Profile</span>
                    </Dialog.Trigger>

                    <Dialog.Portal>
                        <Dialog.Overlay class="settings-overlay" />
                        <Dialog.Content class="settings-content">
                            <Dialog.Title class="settings-title">Create Profile</Dialog.Title>
                            <Dialog.Description class="settings-description">
                                Enter a name for the new profile.
                            </Dialog.Description>

                            <div class="space-y-2">
                                <input
                                    class="input"
                                    type="text"
                                    placeholder="My Profile"
                                    bind:value={newProfileName}
                                    onkeydown={handleCreateProfileInputKeydown}
                                />
                            </div>

                            <div class="flex justify-end gap-2">
                                <Dialog.Close class="btn btn-outline">Cancel</Dialog.Close>
                                <button
                                    class="btn btn-primary"
                                    onclick={confirmCreateProfile}
                                    disabled={!newProfileName.trim()}
                                >
                                    Create
                                </button>
                            </div>

                            <Dialog.Close class="icon-btn absolute right-3 top-3" aria-label="Close">
                                <X size={16} />
                            </Dialog.Close>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>

                {#if profileStore.current !== "Default"}
                    <DropdownMenu.Item
                        class="dropdown-item text-destructive focus:text-destructive hover:bg-red-100"
                        onclick={(e) => openDeleteProfileDialog(profileStore.current, e)}
                    >
                        <span>Delete Current</span>
                    </DropdownMenu.Item>
                {/if}
            </DropdownMenu.Content>
        </DropdownMenu.Root>

        <!-- Tools -->
        <Popover.Root>
            <Popover.Trigger class="icon-btn" title="Tools" aria-label="Tools">
                <Wrench size={20} />
            </Popover.Trigger>
            <Popover.Content
                class="popover-content w-auto! min-w-52"
                side="top"
                align="end"
                sideOffset={8}
            >
                <h4 class="font-medium text-sm mb-2">Tools</h4>
                <div class="grid gap-0.5">
                    <button class="dropdown-item w-full justify-start!" onclick={goHome}>
                        <House class="me-2 h-4 w-4" />
                        <span>Home</span>
                    </button>

                    <Popover.Root>
                        <Popover.Trigger class="dropdown-item w-full justify-start!">
                            {#if settingsStore.theme === "light"}
                                <Sun class="me-2 h-4 w-4" />
                            {:else if settingsStore.theme === "dark"}
                                <Moon class="me-2 h-4 w-4" />
                            {:else}
                                <SunMoon class="me-2 h-4 w-4" />
                            {/if}
                            <span>Theme</span>
                        </Popover.Trigger>
                        <Popover.Content
                            class="popover-content w-auto! min-w-40"
                            side="left"
                            align="start"
                            sideOffset={8}
                        >
                            <h4 class="font-medium text-sm mb-1">Theme</h4>
                            <div class="grid gap-0.5">
                                <button
                                    class="dropdown-item w-full justify-start!"
                                    onclick={() => settingsStore.setTheme("light")}
                                >
                                    <Sun class="me-2 h-4 w-4" />
                                    <span>Light</span>
                                    {#if settingsStore.theme === "light"}
                                        <Check class="ms-2 h-4 w-4" />
                                    {/if}
                                </button>
                                <button
                                    class="dropdown-item w-full justify-start!"
                                    onclick={() => settingsStore.setTheme("dark")}
                                >
                                    <Moon class="me-2 h-4 w-4" />
                                    <span>Dark</span>
                                    {#if settingsStore.theme === "dark"}
                                        <Check class="ms-2 h-4 w-4" />
                                    {/if}
                                </button>
                                <button
                                    class="dropdown-item w-full justify-start!"
                                    onclick={() => settingsStore.setTheme("system")}
                                >
                                    <SunMoon class="me-2 h-4 w-4" />
                                    <span>System</span>
                                    {#if settingsStore.theme === "system"}
                                        <Check class="ms-2 h-4 w-4" />
                                    {/if}
                                </button>
                            </div>
                        </Popover.Content>
                    </Popover.Root>

                    <button
                        class="dropdown-item w-full justify-start!"
                        onclick={() => (settingsOpen = true)}
                    >
                        <Settings class="me-2 h-4 w-4" />
                        <span>Settings</span>
                    </button>

                    {#if towerStore.selectedData}
                        <div class="-mx-1 my-1 h-px bg-muted"></div>
                        <Popover.Root>
                            <Popover.Trigger class="dropdown-item w-full justify-start! text-destructive hover:text-destructive!">
                                <RotateCcw class="me-2 h-4 w-4" />
                                <span>Reset Tower</span>
                            </Popover.Trigger>
                            <Popover.Content
                                class="popover-content"
                                side="left"
                                align="start"
                                sideOffset={8}
                            >
                                <div class="space-y-2">
                                    <h4 class="font-medium leading-none">Confirm Reset</h4>
                                    <p class="text-sm text-muted-foreground">
                                        Are you sure you want to reset all changes for
                                        <span class="font-bold">{towerStore.selectedName}</span>
                                        in profile
                                        <span class="font-bold">{profileStore.current}</span>?
                                        This action cannot be undone.
                                    </p>
                                </div>
                                <div class="flex justify-end mt-4 gap-2">
                                    <Popover.Close class="btn btn-outline">Cancel</Popover.Close>
                                    <Popover.Close
                                        class="btn btn-destructive-fill text-white"
                                        onclick={confirmReset}
                                    >
                                        Confirm
                                    </Popover.Close>
                                </div>
                            </Popover.Content>
                        </Popover.Root>
                    {/if}
                </div>
            </Popover.Content>
        </Popover.Root>
    </div>
</div>

<SettingsModal bind:open={settingsOpen} />

<AlertDialog.Root bind:open={deleteProfileOpen}>
    <AlertDialog.Portal>
        <AlertDialog.Overlay class="settings-overlay" />
        <AlertDialog.Content class="settings-content">
            <div class="flex flex-col space-y-2 text-center sm:text-left">
                <AlertDialog.Title class="text-lg font-semibold">
                    Are you absolutely sure?
                </AlertDialog.Title>
                <AlertDialog.Description class="text-sm text-muted-foreground">
                    This action cannot be undone. This will permanently delete the profile
                    <span class="font-bold text-foreground">{profileToDelete}</span>
                    and remove all data associated with it.
                </AlertDialog.Description>
            </div>
            <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                <AlertDialog.Cancel class="btn btn-outline mt-2 sm:mt-0">
                    Cancel
                </AlertDialog.Cancel>
                <AlertDialog.Action
                    class="btn btn-destructive-fill text-white"
                    onclick={confirmDeleteProfile}
                >
                    Delete
                </AlertDialog.Action>
            </div>
        </AlertDialog.Content>
    </AlertDialog.Portal>
</AlertDialog.Root>

<style>
    @reference "../../routes/layout.css";

    .mobile-root {
        @apply h-screen flex flex-col bg-background;
    }

    .mobile-header {
        @apply border-b bg-card px-4 py-1 flex flex-col items-center gap-2 sticky top-0 z-10;
    }

    .mobile-main {
        @apply flex-1 p-4 overflow-x-auto pb-16;
    }

    .bottom-bar {
        @apply fixed bottom-0 inset-x-0 z-30 h-14 bg-card border-t border-border flex items-center justify-around px-6;
    }
</style>
