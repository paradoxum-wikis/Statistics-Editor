<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";

  import Sidebar from "./Sidebar.svelte";
  import TowerEditor from "./TowerEditor.svelte";
  import HomeView from "./HomeView.svelte";
  import NotFoundView from "./NotFoundView.svelte";
  import TowerPicker from "./TowerPicker.svelte";
  import StatusBar from "./StatusBar.svelte";
  import SettingsModal from "./SettingsModal.svelte";

  import { DropdownMenu, AlertDialog, Dialog } from "bits-ui";
  import ModeToggle from "./smol/ModeToggle.svelte";
  import AuthMenu from "./smol/AuthMenu.svelte";
  import Card from "./smol/Card.svelte";
  import IconBtn from "./smol/IconBtn.svelte";
  import LoadingCard from "./smol/LoadingCard.svelte";
  import Btn from "./smol/Btn.svelte";
  import TextInput from "./smol/TextInput.svelte";
  import Alert from "./smol/Alert.svelte";
  import DiscardMessage, {
    type PendingDiscardAction,
  } from "./smol/DiscardMessage.svelte";
  import { Trash2, Check, X, Store } from "@lucide/svelte";

  let { isClient }: { isClient: boolean } = $props();

  type EditorMode = "cells" | "wiki";

  let settingsOpen = $state(false);
  let editorMode = $state<EditorMode>("cells");
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

  const isNotFound = $derived(page.status >= 400 || towerStore.missingTower);

  const mainKey = $derived(
    !isClient
      ? "init"
      : isNotFound
        ? "not-found"
        : towerStore.selectedName
          ? `tower:${towerStore.selectedName}`
          : "intro",
  );

  async function performGoHome() {
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
        class="sticky top-0 z-7 flex items-center justify-between gap-3 border-b bg-card p-2 px-3"
      >
        <div class="flex min-w-0 items-center gap-3">
          <h1 class="unisans truncate text-3xl font-black text-foreground">
            {towerStore.selectedName || "TDS Statistics Editor"}
          </h1>
          {#if isClient}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                class="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius)_0] border border-border px-3 py-2 text-sm font-medium transition-colors duration-250 hover:bg-muted"
              >
                <span>{profileStore.current}</span>
                <span class="text-xs text-muted-foreground">(Profile)</span>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" class="dropdown-content">
                <DropdownMenu.Group>
                  <DropdownMenu.GroupHeading
                    class="px-2 py-1.5 text-sm font-semibold"
                  >
                    <h4 class="text-sm font-medium">Profiles</h4>
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
                    <Dialog.Overlay class="dialog-overlay" />
                    <Dialog.Content class="dialog-content">
                      <Dialog.Title class="dialog-title">
                        Create Profile
                      </Dialog.Title>
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
        </div>

        <div class="flex shrink-0 items-center space-x-2">
          {#if isClient}
            <IconBtn
              onclick={() =>
                goto(resolve("/workshop"), { keepFocus: true, noScroll: true })
              }
              title="Workshop"
            >
              <Store size={20} />
            </IconBtn>
            <ModeToggle
              bind:mode={editorMode}
              disableCells={towerStore.selectedData?.isMalformed ?? false}
            />
            <AuthMenu />
            <TowerPicker
              variant="compact"
              selected={towerStore.selectedName}
              onSelect={handleSelect}
            />
          {/if}
        </div>
      </header>

      <main
        class="min-h-0 flex-1 overflow-y-auto p-5"
        class:overflow-x-auto={!!towerStore.selectedData}
      >
        {#key mainKey}
          <div
            class="h-full min-h-0"
            in:fly={{ y: 12, duration: 160, easing: cubicOut }}
          >
            {#if isNotFound}
              <NotFoundView onHome={goHome} tower={!!page.params.name} />
            {:else if isClient && !towerStore.selectedData && !towerStore.isLoading}
              <HomeView onSelect={handleSelect} />
            {:else if !isClient}
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
                    <WikiEditor
                      towerName={towerStore.selectedName}
                      open={true}
                    />
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
