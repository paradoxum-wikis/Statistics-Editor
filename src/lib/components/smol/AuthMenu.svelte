<script lang="ts">
  import { Avatar, Dialog, DropdownMenu } from "bits-ui";
  import { ExternalLink, LogOut, UserRound } from "@lucide/svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { fandomUserPage, formatProfileStats } from "$lib/services/fandomAuth";
  import TextInput from "./TextInput.svelte";

  let loginOpen = $state(false);
  let username = $state("");

  const initials = $derived(
    (() => {
      const name = authStore.user?.fandom_username?.trim() ?? "";
      if (!name) return "?";
      const parts = name.split(/\s+/);
      if (parts.length >= 2)
        return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    })(),
  );

  const profileStats = $derived(
    authStore.user ? formatProfileStats(authStore.user) : "",
  );

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

  async function onLogout() {
    await authStore.logout();
  }
</script>

{#if authStore.user}
  {@const user = authStore.user}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      class="inline-flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted transition-colors hover:bg-muted/80"
      aria-label="Account"
    >
      <Avatar.Root
        class="flex size-full items-center justify-center overflow-hidden rounded-full text-xs font-semibold uppercase"
      >
        {#if user.avatar}
          <Avatar.Image
            src={user.avatar}
            alt={user.fandom_username}
            class="size-full object-cover"
          />
        {/if}
        <Avatar.Fallback class="text-muted-foreground"
          >{initials}</Avatar.Fallback
        >
      </Avatar.Root>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="dropdown-content min-w-48">
      <DropdownMenu.Group>
        <DropdownMenu.GroupHeading class="px-2 py-1.5">
          <p class="text-sm font-medium">{user.fandom_username}</p>
          <p class="text-xs text-muted-foreground">{profileStats}</p>
        </DropdownMenu.GroupHeading>
      </DropdownMenu.Group>
      <DropdownMenu.Separator class="-mx-1 my-1 h-px bg-muted" />
      <DropdownMenu.Item class="dropdown-item">
        {#snippet child({ props })}
          <a
            {...props}
            href={fandomUserPage(user.fandom_username)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            <span>Wiki profile</span>
          </a>
        {/snippet}
      </DropdownMenu.Item>
      <DropdownMenu.Item class="dropdown-item" onclick={onLogout}>
        <LogOut size={14} />
        <span>Sign out</span>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else}
  <Dialog.Root
    bind:open={loginOpen}
    onOpenChange={(open) => {
      if (!open) authStore.clearChallenge();
    }}
  >
    <Dialog.Trigger
      class="inline-flex items-center gap-2 rounded-[var(--radius)_0] border border-border px-3 py-2 text-sm font-medium transition-colors duration-250 hover:bg-muted"
      onclick={() => authStore.clearChallenge()}
    >
      <UserRound size={16} />
      <span class="hidden sm:inline">Sign in</span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay class="dialog-overlay" />
      <Dialog.Content class="dialog-content max-w-md">
        <Dialog.Title class="dialog-title">Sign in with Fandom</Dialog.Title>
        <Dialog.Description class="dialog-description">
          Prove you own a Fandom account by saving a short verify page on the
          TDS wiki.
        </Dialog.Description>

        {#if !authStore.challenge}
          <div class="space-y-2">
            <label class="text-sm font-medium" for="fandom-username">
              Fandom username
            </label>
            <TextInput
              id="fandom-username"
              type="text"
              placeholder="YourUsername"
              bind:value={username}
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === "Enter") void onStart();
              }}
            />
          </div>
          {#if authStore.error}
            <p class="text-sm text-destructive">{authStore.error}</p>
          {/if}
          <div class="flex justify-end gap-2">
            <Dialog.Close class="btn btn-outline">Cancel</Dialog.Close>
            <button
              type="button"
              class="btn btn-primary"
              disabled={authStore.busy || !username.trim()}
              onclick={onStart}
            >
              {authStore.busy ? "Checking…" : "Continue"}
            </button>
          </div>
        {:else}
          <div class="space-y-3 text-sm">
            <p>
              Signed in as wiki user
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
          {#if authStore.error}
            <p class="text-sm text-destructive">{authStore.error}</p>
          {/if}
          <div class="flex justify-end gap-2">
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
          </div>
        {/if}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}
