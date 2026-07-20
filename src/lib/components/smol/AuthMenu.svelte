<script lang="ts">
  import { Popover } from "bits-ui";
  import { BookOpenText, LogOut } from "@lucide/svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { fandomUserPage, formatProfileStats } from "$lib/services/fandomAuth";
  import Alert from "./Alert.svelte";
  import Modal from "./Modal.svelte";
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

  {#snippet logoutBody()}
    Sign out of Fandom account
    <span class="font-bold">{user.fandom_username}</span>? You can sign back in
    anytime by verifying on the wiki again.
  {/snippet}

  <Alert
    bind:open={logoutOpen}
    title="Sign out?"
    body={logoutBody}
    confirmLabel="Let me out!"
    confirmClass="btn btn-destructive-fill text-white"
    onConfirm={confirmLogout}
  />
{:else}
  <Modal
    bind:open={loginOpen}
    title="Sign in with Fandom"
    description="Prove you are who you are by saving a verification page on the Tower Defense Simulator Wiki."
    class="max-w-md"
    onOpenChange={(next) => {
      if (!next) authStore.clearChallenge();
    }}
  >
    {#snippet trigger({ props })}
      <button
        type="button"
        class={avatarBtn}
        aria-label="Sign in with Fandom"
        {...props}
      >
        <img src={avatarPlaceholder} alt="" class="size-full object-cover" />
      </button>
    {/snippet}

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

    {#snippet footer()}
      <div class="flex justify-end gap-2">
        {#if !authStore.challenge}
          <button
            type="button"
            class="btn btn-outline"
            onclick={() => (loginOpen = false)}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={authStore.busy || !username.trim()}
            onclick={onStart}
          >
            {authStore.busy ? "Checking..." : "Continue"}
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
            {authStore.busy ? "Verifying..." : "I've saved"}
          </button>
        {/if}
      </div>
    {/snippet}
  </Modal>
{/if}
