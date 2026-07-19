<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { cubicOut } from "svelte/easing";
  import { fly, fade } from "svelte/transition";

  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";

  import Sidebar from "./Sidebar.svelte";
  import TowerEditor from "./TowerEditor.svelte";
  import HomeView from "./HomeView.svelte";
  import NotFoundView from "./NotFoundView.svelte";
  import TowerPicker from "./TowerPicker.svelte";
  import SettingsModal from "./SettingsModal.svelte";
  import GlobalModifier from "./tool/GlobalModifier.svelte";
  import GlobalModifierModal from "./tool/GlobalModifierModal.svelte";
  import CreateTower from "./tool/CreateTower.svelte";

  import { DropdownMenu, Popover, AlertDialog, Dialog } from "bits-ui";
  import ModeToggle from "./smol/ModeToggle.svelte";
  import AuthMenu from "./smol/AuthMenu.svelte";
  import Card from "./smol/Card.svelte";
  import LoadingCard from "./smol/LoadingCard.svelte";
  import Btn from "./smol/Btn.svelte";
  import IconBtn from "./smol/IconBtn.svelte";
  import Tip from "./smol/Tip.svelte";
  import TextInput from "./smol/TextInput.svelte";

  import Alert from "./smol/Alert.svelte";
  import DiscardMessage, {
    type PendingDiscardAction,
  } from "./smol/DiscardMessage.svelte";
  import {
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
  let wikiEditorModule = $state<Awaited<
    typeof import("./WikiEditor.svelte")
  > | null>(null);
  let wikiEditorLoadFailed = $state(false);

  $effect(() => {
    if (!isClient || !towerStore.selectedData) return;
    wikiEditorLoadFailed = false;
    void import("./WikiEditor.svelte")
      .then((mod) => {
        wikiEditorModule = mod;
      })
      .catch(() => {
        wikiEditorLoadFailed = true;
      });
  });

  let toolsOpen = $state(false);
  let modifierOpen = $state(false);

  const isNotFound = $derived(page.status >= 400 || towerStore.missingTower);

  async function performGoHome() {
    sidebarOpen = false;
    towerStore.unload();
    editorMode = "cells";
    await goto(resolve("/"), { keepFocus: true, noScroll: true });
  }

  async function performTowerSelect(tower: string) {
    const success = await towerStore.load(tower);
    if (success) {
      await goto(resolve("/tower/[name]", { name: towerStore.selectedName }), {
        keepFocus: true,
        noScroll: true,
      });
    }
  }

  async function handleSelect(itemValue: string | undefined) {
    if (
      !itemValue ||
      itemValue.toLowerCase() === towerStore.selectedName.toLowerCase()
    )
      return;
    if (towerStore.isDirty) {
      requestDiscard({ type: "switch-tower", tower: itemValue });
      return;
    }
    await performTowerSelect(itemValue);
  }

  async function confirmReset() {
    await towerStore.reset();
  }

  let discardOpen = $state(false);
  let pendingDiscardAction = $state<PendingDiscardAction | null>(null);

  async function performProfileSwitch(profile: string) {
    if (profileStore.switch(profile)) {
      await towerStore.switchProfile(profile);
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

  let createProfileOpen = $state(false);
  let newProfileName = $state("");

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

  function openCreateProfileDialog() {
    newProfileName = "";
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
  <!-- Sidebar Scrim -->
  {#if sidebarOpen}
    <div
      class="dialog-overlay"
      role="presentation"
      onclick={() => (sidebarOpen = false)}
      transition:fade={{ duration: 200 }}
    ></div>
  {/if}

  <div
    class="fixed inset-y-0 left-0 z-57 w-72 transition-transform duration-200 {sidebarOpen
      ? 'translate-x-0'
      : '-translate-x-full'}"
  >
    <Sidebar class="h-full" />
  </div>

  <!-- Header -->
  <header
    class="sticky top-0 z-17 flex flex-col items-center gap-2 border-b bg-card/20 px-4 py-1"
  >
    <h1 class="text-sm font-bold text-foreground tracking-wide">
      {towerStore.selectedName || "TDS Statistics Editor"}
    </h1>

    {#if isClient}
      <TowerPicker
        variant="compact"
        selected={towerStore.selectedName}
        onSelect={handleSelect}
      />

      <ModeToggle
        bind:mode={editorMode}
        disableCells={towerStore.selectedData?.isMalformed ?? false}
      />
      <AuthMenu />
    {/if}
  </header>

  <!-- Main Content -->
  <main class="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-4 pb-16">
    {#key `${isClient}-${isNotFound}-${towerStore.isLoading}-${towerStore.selectedName ?? ""}-${editorMode}`}
      {#if isNotFound}
        <NotFoundView onHome={goHome} tower={!!page.params.name} />
      {:else if isClient && !towerStore.selectedData && !towerStore.isLoading}
        <HomeView onSelect={handleSelect} />
      {:else}
        <div in:fly={{ y: 8, duration: 160, easing: cubicOut }}>
          {#if !isClient}
            <LoadingCard
              message="Engineer is setting up the editor for you..."
            />
          {:else if towerStore.selectedData}
            {#key editorMode}
              <div in:fly={{ y: 8, duration: 160, easing: cubicOut }}>
                {#if editorMode === "cells" && !towerStore.selectedData.isMalformed}
                  <TowerEditor tower={towerStore.selectedData} />
                {:else if wikiEditorModule}
                  {@const WikiEditor = wikiEditorModule.default}
                  <WikiEditor towerName={towerStore.selectedName} open={true} />
                {:else if wikiEditorLoadFailed}
                  <Card class="p-8 text-center">
                    <p class="text-red-600">
                      Failed to load the source editor.
                    </p>
                  </Card>
                {:else}
                  <LoadingCard
                    message="Brawler is unpacking the source editor..."
                  />
                {/if}
              </div>
            {/key}
          {:else}
            <LoadingCard
              message="Commander is getting this tower's files ready..."
            />
          {/if}
        </div>
      {/if}
    {/key}
  </main>

  <!-- Bottom Bar -->
  <div
    class="fixed inset-x-0 bottom-0 z-37 flex h-14 items-center justify-around border-t border-border bg-card px-6"
  >
    <IconBtn
      onclick={() => (sidebarOpen = !sidebarOpen)}
      title={towerStore.selectedData ? "Toggle Sidebar" : "Recent Updates"}
      aria-label={towerStore.selectedData ? "Toggle sidebar" : "Recent updates"}
    >
      <PanelLeft size={20} />
    </IconBtn>

    <!-- Profile -->
    <DropdownMenu.Root>
      <Tip content="Profile">
        {#snippet children({ props })}
          <DropdownMenu.Trigger
            class="icon-btn"
            aria-label="Profile"
            {...props}
          >
            <User size={20} />
          </DropdownMenu.Trigger>
        {/snippet}
      </Tip>
      <DropdownMenu.Content align="center" side="top" class="dropdown-content">
        <DropdownMenu.Group>
          <DropdownMenu.GroupHeading class="px-2 py-1.5 text-sm font-semibold">
            <h4 class="text-sm font-medium">Profiles</h4>
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
            class="dropdown-item w-full text-start"
            onclick={openCreateProfileDialog}
          >
            <span>+ Create Profile</span>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay class="dialog-overlay" />
            <Dialog.Content class="dialog-content">
              <Dialog.Title class="dialog-title">Create Profile</Dialog.Title>
              <Dialog.Description class="dialog-description">
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
                <Dialog.Close class="btn btn-outline">Cancel</Dialog.Close>
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
            onclick={(e) => openDeleteProfileDialog(profileStore.current, e)}
          >
            <span>Delete Current</span>
          </DropdownMenu.Item>
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <!-- Tools -->
    <Popover.Root bind:open={toolsOpen}>
      <Tip content="Tools">
        {#snippet children({ props })}
          <Popover.Trigger class="icon-btn" aria-label="Tools" {...props}>
            <Wrench size={20} />
          </Popover.Trigger>
        {/snippet}
      </Tip>
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

          <GlobalModifier
            variant="menu"
            onOpen={() => {
              toolsOpen = false;
              modifierOpen = true;
            }}
          />

          <CreateTower
            variant="menu"
            onCreated={async (name) => {
              toolsOpen = false;
              await performTowerSelect(name);
            }}
          />

          {#if towerStore.selectedData}
            <div class="-mx-1 my-1 h-px bg-muted"></div>
            <Popover.Root>
              <Popover.Trigger
                class="dropdown-item w-full justify-start! text-destructive hover:text-destructive!"
              >
                {#if towerStore.isCustomSelected()}
                  <Trash2 class="me-2 h-4 w-4" />
                  <span>Delete Tower</span>
                {:else}
                  <RotateCcw class="me-2 h-4 w-4" />
                  <span>Reset Tower</span>
                {/if}
              </Popover.Trigger>
              <Popover.Content
                class="popover-content"
                side="top"
                align="start"
                sideOffset={8}
              >
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
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>
</div>

<SettingsModal bind:open={settingsOpen} />
<GlobalModifierModal bind:open={modifierOpen} />

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
    <AlertDialog.Overlay class="dialog-overlay" />
    <AlertDialog.Content class="dialog-content">
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
