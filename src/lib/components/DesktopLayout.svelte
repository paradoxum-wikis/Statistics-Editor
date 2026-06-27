<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";

  import Sidebar from "./Sidebar.svelte";
  import TowerEditor from "./TowerEditor.svelte";
  import Introduction from "./Introduction.svelte";
  import StatusBar from "./StatusBar.svelte";
  import SettingsModal from "./SettingsModal.svelte";

  import {
    Combobox,
    DropdownMenu,
    Popover,
    AlertDialog,
    Dialog,
  } from "bits-ui";
  import ModeToggle from "./smol/ModeToggle.svelte";
  import Card from "./smol/Card.svelte";
  import Btn from "./smol/Btn.svelte";
  import TextInput from "./smol/TextInput.svelte";
  import Alert from "./smol/Alert.svelte";
  import DiscardMessage, {
    type PendingDiscardAction,
  } from "./smol/DiscardMessage.svelte";
  import { Trash2, Check, ChevronsUpDown, X } from "@lucide/svelte";

  let { isClient }: { isClient: boolean } = $props();

  type EditorMode = "cells" | "wiki";

  let settingsOpen = $state(false);
  let editorMode = $state<EditorMode>("cells");

  let searchValue = $state("");
  let comboboxOpen = $state(false);

  let items = $derived(
    towerStore.names.map((name) => ({
      value: name,
      label: name,
    })),
  );

  let filteredTowers = $derived(
    searchValue === ""
      ? items
      : items.filter((item) =>
          item.label.toLowerCase().includes(searchValue.toLowerCase()),
        ),
  );

  const mainKey = $derived(
    !isClient
      ? "init"
      : towerStore.selectedName
        ? `tower:${towerStore.selectedName}`
        : towerStore.isLoading
          ? "loading"
          : "intro",
  );

  async function performGoHome() {
    const url = new URL(page.url);
    const hadTowerParam = url.searchParams.has("tower");
    towerStore.unload();

    if (hadTowerParam) url.searchParams.delete("tower");
    editorMode = "cells";
    await goto(url, { keepFocus: true, noScroll: true });
  }

  async function performTowerSelect(tower: string) {
    const success = await towerStore.load(tower);
    if (success) {
      searchValue = "";
      const url = new URL(page.url);
      url.searchParams.set("tower", tower);
      await goto(url, { keepFocus: true, noScroll: true });
      comboboxOpen = false;
    }
  }

  async function handleSelect(itemValue: string | undefined) {
    if (!itemValue || itemValue === towerStore.selectedName) return;
    if (towerStore.isDirty) {
      requestDiscard({ type: "switch-tower", tower: itemValue });
      return;
    }
    await performTowerSelect(itemValue);
  }

  async function confirmReset() {
    if (towerStore.selectedData) {
      await towerStore.reset();
    }
  }

  let discardOpen = $state(false);
  let pendingDiscardAction = $state<PendingDiscardAction | null>(null);

  async function performProfileSwitch(profile: string) {
    if (profileStore.switch(profile)) {
      await towerStore.switchProfile(profile);
      searchValue = "";
    }
  }

  function requestDiscard(action: PendingDiscardAction) {
    pendingDiscardAction = action;
    discardOpen = true;
  }

  async function handleProfileChange(newProfile: string) {
    if (newProfile === profileStore.current) return;
    if (towerStore.isDirty) {
      requestDiscard({ type: "switch-profile", profile: newProfile });
      return;
    }
    await performProfileSwitch(newProfile);
  }

  function cancelDiscard() {
    pendingDiscardAction = null;
  }

  async function createProfile(name: string) {
    if (profileStore.create(name)) {
      await towerStore.switchProfile(name);
      newProfileName = "";
      createProfileOpen = false;
    }
  }

  async function confirmDiscard() {
    const pending = pendingDiscardAction;
    pendingDiscardAction = null;
    discardOpen = false;
    if (!pending) return;

    switch (pending.type) {
      case "create-profile":
        await createProfile(pending.name);
        break;
      case "switch-profile":
        await performProfileSwitch(pending.profile);
        break;
      case "switch-tower":
        await performTowerSelect(pending.tower);
        break;
      case "go-home":
        await performGoHome();
        break;
    }
  }

  let createProfileOpen = $state(false);
  let newProfileName = $state("");

  function openCreateProfileDialog() {
    newProfileName = "";
    createProfileOpen = true;
  }

  async function goHome() {
    if (towerStore.isDirty) {
      requestDiscard({ type: "go-home" });
      return;
    }
    await performGoHome();
  }

  async function confirmCreateProfile() {
    const name = newProfileName.trim();
    if (!name) return;
    if (towerStore.isDirty) {
      requestDiscard({ type: "create-profile", name });
      return;
    }
    await createProfile(name);
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

  async function confirmDeleteProfile() {
    if (profileToDelete) {
      const deletedCurrent = profileToDelete === profileStore.current;
      if (profileStore.delete(profileToDelete) && deletedCurrent) {
        await towerStore.switchProfile(profileStore.current);
      }
      profileToDelete = null;
    }
    deleteProfileOpen = false;
  }
</script>

<div class="flex h-screen flex-col bg-background">
  <div class="flex min-h-0 flex-1">
    <Sidebar class="h-full w-[17%] shrink-0" />

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-2 px-3"
      >
        <h1 class="unisans text-3xl font-black text-foreground">
          {towerStore.selectedName || "TDS Statistics Editor"}
        </h1>
        <div class="flex items-center space-x-4">
          {#if isClient}
            <ModeToggle
              bind:mode={editorMode}
              disableCells={towerStore.selectedData?.isMalformed ?? false}
            />

            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                class="inline-flex items-center gap-2 rounded-[var(--radius)_0] border border-border px-3 py-2 text-sm font-medium transition-colors duration-250 hover:bg-muted"
              >
                <span>{profileStore.current}</span>
                <span class="text-xs text-muted-foreground">(Profile)</span>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" class="dropdown-content">
                <DropdownMenu.Group>
                  <DropdownMenu.GroupHeading
                    class="px-2 py-1.5 text-sm font-semibold"
                  >
                    Profiles
                  </DropdownMenu.GroupHeading>
                  {#each profileStore.list as profile (profile)}
                    <DropdownMenu.Item
                      onclick={() => handleProfileChange(profile)}
                      class="dropdown-item"
                    >
                      <span>{profile}</span>
                      {#if profile === profileStore.current}
                        <span class="ms-auto">
                          <Check size={14} />
                        </span>
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
                    class="dropdown-item w-full text-start"
                    onclick={openCreateProfileDialog}
                  >
                    <span>+ Create Profile</span>
                  </Dialog.Trigger>

                  <Dialog.Portal>
                    <Dialog.Overlay class="settings-overlay" />
                    <Dialog.Content class="settings-content">
                      <Dialog.Title class="settings-title">
                        Create Profile
                      </Dialog.Title>
                      <Dialog.Description class="settings-description">
                        Enter a name for the new profile.
                      </Dialog.Description>

                      <div class="space-y-2">
                        <TextInput
                          type="text"
                          placeholder="My Profile"
                          bind:value={newProfileName}
                          onkeydown={handleCreateProfileInputKeydown}
                        />
                      </div>

                      <div class="flex justify-end gap-2">
                        <Dialog.Close class="btn btn-outline">
                          Cancel
                        </Dialog.Close>
                        <Btn
                          variant="primary"
                          onclick={confirmCreateProfile}
                          disabled={!newProfileName.trim()}
                        >
                          Create
                        </Btn>
                      </div>

                      <Dialog.Close
                        class="icon-btn absolute right-3 top-3"
                        aria-label="Close"
                      >
                        <X size={16} />
                      </Dialog.Close>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>

                {#if profileStore.current !== "Default"}
                  <DropdownMenu.Item
                    class="dropdown-item text-destructive focus:text-destructive hover:bg-red-100"
                    onclick={(e) =>
                      openDeleteProfileDialog(profileStore.current, e)}
                  >
                    <span>Delete Current</span>
                  </DropdownMenu.Item>
                {/if}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          {/if}

          {#if towerStore.selectedData}
            <Popover.Root>
              <Popover.Trigger class="btn btn-destructive text-white">
                {towerStore.isCustomSelected() ? "Delete Tower" : "Reset Tower"}
              </Popover.Trigger>
              <Popover.Content class="popover-content">
                <div class="space-y-2">
                  <h4 class="font-medium leading-none">
                    {towerStore.isCustomSelected()
                      ? "Confirm Delete"
                      : "Confirm Reset"}
                  </h4>
                  <p class="text-sm text-muted-foreground">
                    {#if towerStore.isCustomSelected()}
                      Are you sure you want to permanently delete
                      <span class="font-bold">{towerStore.selectedName}</span>?
                      This removes the tower and all saved data across every
                      profile.
                    {:else}
                      Are you sure you want to reset all changes for
                      <span class="font-bold">{towerStore.selectedName}</span>
                      in profile
                      <span class="font-bold">{profileStore.current}</span>?
                      This action cannot be undone.
                    {/if}
                  </p>
                </div>
                <div class="flex justify-end mt-4 gap-2">
                  <Popover.Close class="btn btn-outline">Cancel</Popover.Close>
                  <Popover.Close
                    class="btn btn-destructive-fill text-white"
                    onclick={towerStore.isCustomSelected()
                      ? () => towerStore.confirmDeleteTower()
                      : confirmReset}
                  >
                    Confirm
                  </Popover.Close>
                </div>
              </Popover.Content>
            </Popover.Root>
          {/if}

          {#if isClient}
            <div class="flex items-center space-x-2">
              <Combobox.Root
                type="single"
                {items}
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
                    class="combobox-input"
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
                              <span
                                class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"
                              >
                                <Check class="h-4 w-4" />
                              </span>
                            {/if}
                          {/snippet}
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

      <main class="flex-1 p-5 overflow-x-auto">
        {#key mainKey}
          <div in:fly={{ y: 8, duration: 160, easing: cubicOut }}>
            {#if !isClient}
              <Card class="p-8 text-center">
                <p class="animate-pulse text-body">
                  Engineer is setting up the editor for you...
                </p>
              </Card>
            {:else if towerStore.selectedData}
              {#key editorMode}
                <div in:fly={{ y: 8, duration: 160, easing: cubicOut }}>
                  {#if editorMode === "cells" && !towerStore.selectedData.isMalformed}
                    <TowerEditor tower={towerStore.selectedData} />
                  {:else}
                    {#await import("./WikiEditor.svelte") then { default: WikiEditor }}
                      <WikiEditor
                        towerName={towerStore.selectedName}
                        open={true}
                      />
                    {:catch}
                      <Card class="p-8 text-center">
                        <p class="text-body text-red-600">
                          Failed to load the source editor.
                        </p>
                      </Card>
                    {/await}
                  {/if}
                </div>
              {/key}
            {:else if towerStore.isLoading}
              <Card class="p-8 text-center">
                <p class="animate-pulse text-body">
                  Commander is getting this tower's files ready...
                </p>
              </Card>
            {:else}
              <Introduction />
            {/if}
          </div>
        {/key}
      </main>
    </div>
  </div>

  <StatusBar
    bind:settingsOpen
    onHome={goHome}
    onTowerCreated={performTowerSelect}
  />
</div>

<SettingsModal bind:open={settingsOpen} />

{#snippet discardBody()}
  {#if pendingDiscardAction}
    <DiscardMessage
      action={pendingDiscardAction}
      towerName={towerStore.selectedName}
      profileName={profileStore.current}
    />
  {/if}
{/snippet}

<Alert
  bind:open={discardOpen}
  title="Discard unsaved changes?"
  body={discardBody}
  confirmLabel="Discard and continue"
  confirmClass="btn btn-destructive-fill text-white"
  onConfirm={confirmDiscard}
  onCancel={cancelDiscard}
/>

<AlertDialog.Root bind:open={deleteProfileOpen}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="settings-overlay" />
    <AlertDialog.Content class="settings-content">
      <div class="flex flex-col space-y-2 text-center sm:text-start">
        <AlertDialog.Title class="text-lg font-semibold">
          Are you absolutely sure?
        </AlertDialog.Title>
        <AlertDialog.Description class="text-sm text-muted-foreground">
          This action cannot be undone. This will permanently delete the profile
          <span class="font-bold text-foreground">{profileToDelete}</span>
          and remove all data associated with it.
        </AlertDialog.Description>
      </div>
      <div
        class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"
      >
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
