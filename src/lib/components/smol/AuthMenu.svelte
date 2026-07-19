<script lang="ts">
  import { AlertDialog, Dialog, Popover } from "bits-ui";
  import { BookOpenText, LogOut } from "@lucide/svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { fandomUserPage, formatProfileStats } from "$lib/services/fandomAuth";
  import TextInput from "./TextInput.svelte";
  import Separator from "./Separator.svelte";
  import avatarPlaceholder from "$lib/assets/Avatar.png";

  const avatarBtn =
    "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted transition-colors hover:bg-muted/80";

  let loginOpen = $state(false);
  let accountOpen = $state(false);
  let logoutOpen = $state(false);
  let username = $state("");

  const profileStats = $derived(
    authStore.user ? formatProfileStats(authStore.user) : "",
  );
  const avatarSrc = $derived(authStore.user?.avatar || avatarPlaceholder);

  async function onStart() {
    const name = username.trim();
    if (!name) return;
    await authStore.start(name);
  }

  async function onComplete() {
    await authStore.complete();
    if (!authStore.error) {
      loginOpen = false;
      username = "";
    }
  }

  function requestLogout() {
    accountOpen = false;
    logoutOpen = true;
  }

  async function confirmLogout() {
    logoutOpen = false;
    await authStore.logout();
  }
</script>

{#if authStore.user}
  {@const user = authStore.user}
  <Popover.Root bind:open={accountOpen}>
    <Popover.Trigger class={avatarBtn} aria-label="Account">
      <img
        src={avatarSrc}
        alt={user.fandom_username}
        class="size-full object-cover"
      />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        class="dropdown-content w-auto! min-w-42"
        align="end"
        sideOffset={6}
      >
        <h4 class="mb-1 px-2 pt-1 text-sm font-medium">
          {user.fandom_username}
        </h4>
        <p class="mb-1 px-2 text-xs text-muted-foreground">{profileStats}</p>
        <Separator class="my-2" />
        <div class="grid gap-0.5">
          <a
            class="dropdown-item w-full justify-start!"
            href={fandomUserPage(user.fandom_username)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpenText class="me-2 h-4 w-4" />
            <span>Wiki Profile</span>
          </a>
          <button
            type="button"
            class="dropdown-item w-full justify-start!"
            onclick={requestLogout}
          >
            <LogOut class="me-2 h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>

  <AlertDialog.Root bind:open={logoutOpen}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay class="dialog-overlay" />
      <AlertDialog.Content class="dialog-content">
        <div class="flex flex-col space-y-2 text-center sm:text-left">
          <AlertDialog.Title class="text-lg font-semibold">
            Sign out?
          </AlertDialog.Title>
          <AlertDialog.Description class="text-sm text-muted-foreground">
            Sign out of Fandom account
            <span class="font-bold">{user.fandom_username}</span>? You can sign
            back in anytime by verifying on the wiki again.
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
            onclick={confirmLogout}
          >
            Let me out!
          </AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>
{:else}
  <Dialog.Root
    bind:open={loginOpen}
    onOpenChange={(open) => {
      if (!open) authStore.clearChallenge();
    }}
  >
    <Dialog.Trigger
      class={avatarBtn}
      aria-label="Sign in with Fandom"
      onclick={() => authStore.clearChallenge()}
    >
      <img src={avatarPlaceholder} alt="" class="size-full object-cover" />
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay class="dialog-overlay" />
      <Dialog.Content class="dialog-content max-w-md">
        <Dialog.Title class="dialog-title">Sign in with Fandom</Dialog.Title>
        <Dialog.Description class="dialog-description">
          Prove you own a Fandom account by saving a short verify page on the
          Tower Defense Simulator Wiki.
        </Dialog.Description>

        {#if !authStore.challenge}
          <div class="space-y-2">
            <label class="text-sm font-medium" for="fandom-username">
              Username
            </label>
            <TextInput
              id="fandom-username"
              type="text"
              placeholder="C'mon, put it here..."
              bind:value={username}
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === "Enter") void onStart();
              }}
            />
          </div>
        {:else}
          <div class="space-y-3 text-sm">
            <p>
              Signed in as wikiling
              <strong>{authStore.challenge.fandom_username}</strong>? Open the
              editor, save (Alt+Shift+S), then confirm here.
            </p>
            <a
              class="btn btn-primary inline-flex w-full justify-center"
              href={authStore.challenge.edit_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Fandom editor
            </a>
            <p class="text-xs text-muted-foreground break-all">
              Summary must be:
              <code class="rounded bg-muted px-1"
                >{authStore.challenge.summary}</code
              >
            </p>
          </div>
        {/if}

        {#if authStore.error}
          <p class="text-sm text-destructive">{authStore.error}</p>
        {/if}

        <div class="flex justify-end gap-2">
          {#if !authStore.challenge}
            <Dialog.Close class="btn btn-outline">Cancel</Dialog.Close>
            <button
              type="button"
              class="btn btn-primary"
              disabled={authStore.busy || !username.trim()}
              onclick={onStart}
            >
              {authStore.busy ? "Checking…" : "Continue"}
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-outline"
              disabled={authStore.busy}
              onclick={() => authStore.clearChallenge()}
            >
              Back
            </button>
            <button
              type="button"
              class="btn btn-primary"
              disabled={authStore.busy}
              onclick={onComplete}
            >
              {authStore.busy ? "Verifying…" : "I've saved"}
            </button>
          {/if}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}
