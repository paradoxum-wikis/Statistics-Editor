<script lang="ts">
  import { resolve } from "$app/paths";
  import { AspectRatio, Avatar, Dialog, Separator, Toggle } from "bits-ui";
  import {
    CalendarClock,
    CalendarPlus,
    Eye,
    ThumbsUp,
    Trash2,
    X,
  } from "@lucide/svelte";
  import avatarPlaceholder from "$lib/assets/Avatar.png";
  import { authStore } from "$lib/stores/auth.svelte";
  import { fetchFandomAvatar } from "$lib/services/fandomAuth";
  import { imageLoader } from "$lib/services/imageLoader";
  import {
    createWorkshopComment,
    deleteWorkshopComment,
    getWorkshopListing,
    listWorkshopComments,
    toggleWorkshopVote,
    WORKSHOP_TAG_FEATURED,
    type WorkshopComment,
    type WorkshopListing,
  } from "$lib/services/workshop";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { timeAgo } from "$lib/utils/workshop";
  import { toast } from "$lib/toast";
  import Alert from "../smol/Alert.svelte";
  import Btn from "../smol/Btn.svelte";
  import Tip from "../smol/Tip.svelte";

  let {
    open = $bindable(false),
    listingId = $bindable<string | null>(null),
    onChanged,
  }: {
    open?: boolean;
    listingId?: string | null;
    onChanged?: (listing: WorkshopListing) => void;
  } = $props();

  let listing = $state<WorkshopListing | null>(null);
  let comments = $state<WorkshopComment[]>([]);
  let loading = $state(false);
  let commentsLoading = $state(false);
  let commentsError = $state<string | null>(null);
  let error = $state<string | null>(null);
  let voteBusy = $state(false);
  let commentBody = $state("");
  let commentBusy = $state(false);
  let imageUrl = $state<string | null>(null);
  let authorAvatar = $state<string | null>(null);
  let avatars = $state(new Map<number, string>());
  let deleteOpen = $state(false);
  let deleteTarget = $state<WorkshopComment | null>(null);

  const openHref = $derived(
    listing
      ? `${resolve("/tower/[name]", { name: listing.tower_name })}?share=${encodeURIComponent(listing.share_id)}`
      : "#",
  );
  const featured = $derived(
    listing?.tags.includes(WORKSHOP_TAG_FEATURED) ?? false,
  );

  function rememberAvatar(userId: number, url: string) {
    const next = new Map(avatars);
    next.set(userId, url);
    avatars = next;
  }

  async function loadDetail(id: string) {
    loading = true;
    error = null;
    listing = null;
    comments = [];
    imageUrl = null;
    authorAvatar = null;
    try {
      const item = await getWorkshopListing(id);
      listing = item;
      onChanged?.(item);
      const ref = item.image?.trim();
      if (ref) {
        imageUrl =
          imageLoader.getCachedUrl(item.id, 0, ref) ??
          (await imageLoader.loadImage(item.id, 0, ref));
      }
      fetchFandomAvatar(item.author.fandom_userid)
        .then((url) => {
          if (url) {
            authorAvatar = url;
            rememberAvatar(item.author.fandom_userid, url);
          }
        })
        .catch((e) => {
          if (settingsStore.debugMode)
            console.error("[workshop] author avatar", e);
        });
      void loadComments(id);
    } catch (e) {
      if (settingsStore.debugMode) console.error("[workshop] detail", e);
      error = e instanceof Error ? e.message : "Failed to load listing.";
    } finally {
      loading = false;
    }
  }

  async function loadComments(id: string) {
    commentsLoading = true;
    commentsError = null;
    try {
      const res = await listWorkshopComments(id);
      comments = res.items;
      for (const c of res.items) {
        const uid = c.author.fandom_userid;
        if (avatars.has(uid)) continue;
        fetchFandomAvatar(uid)
          .then((url) => {
            if (url) rememberAvatar(uid, url);
          })
          .catch((e) => {
            if (settingsStore.debugMode)
              console.error("[workshop] comment avatar", e);
          });
      }
    } catch (e) {
      if (settingsStore.debugMode) console.error("[workshop] comments", e);
      commentsError =
        e instanceof Error ? e.message : "Failed to load comments.";
      comments = [];
    } finally {
      commentsLoading = false;
    }
  }

  $effect(() => {
    if (!open || !listingId) {
      listing = null;
      comments = [];
      error = null;
      commentsError = null;
      commentBody = "";
      return;
    }
    void loadDetail(listingId);
  });

  async function onVote() {
    if (!listing || voteBusy) return;
    if (!authStore.user) {
      toast.error("Sign in with Fandom to upvote.");
      return;
    }
    voteBusy = true;
    try {
      const res = await toggleWorkshopVote(listing.id);
      listing = { ...listing, votes: res.votes, voted: res.voted };
      onChanged?.(listing);
    } catch (e) {
      if (settingsStore.debugMode) console.error("[workshop] vote", e);
      toast.error(e instanceof Error ? e.message : "Vote failed.");
    } finally {
      voteBusy = false;
    }
  }

  async function onComment() {
    if (!listing || commentBusy) return;
    if (!authStore.user) {
      toast.error("Sign in with Fandom to comment.");
      return;
    }
    const body = commentBody.trim();
    if (!body) return;
    commentBusy = true;
    try {
      const c = await createWorkshopComment(listing.id, body);
      comments = [...comments, c];
      commentBody = "";
      fetchFandomAvatar(c.author.fandom_userid)
        .then((url) => {
          if (url) rememberAvatar(c.author.fandom_userid, url);
        })
        .catch((e) => {
          if (settingsStore.debugMode)
            console.error("[workshop] comment avatar", e);
        });
    } catch (e) {
      if (settingsStore.debugMode) console.error("[workshop] post comment", e);
      toast.error(e instanceof Error ? e.message : "Comment failed.");
    } finally {
      commentBusy = false;
    }
  }

  function askDeleteComment(c: WorkshopComment) {
    deleteTarget = c;
    deleteOpen = true;
  }

  async function confirmDeleteComment() {
    if (!listing || !deleteTarget) return;
    try {
      await deleteWorkshopComment(listing.id, deleteTarget.id);
      comments = comments.filter((x) => x.id !== deleteTarget!.id);
    } catch (e) {
      if (settingsStore.debugMode)
        console.error("[workshop] delete comment", e);
      toast.error(e instanceof Error ? e.message : "Couldn't delete comment.");
    } finally {
      deleteTarget = null;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content
      class="dialog-content flex! max-h-[92dvh] w-[min(96vw,72rem)] max-w-[min(96vw,72rem)]! flex-col gap-0 overflow-hidden p-0! md:h-[min(92dvh,56rem)]"
    >
      <div
        class="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4"
      >
        <div class="min-w-0">
          <Dialog.Title class="truncate text-xl font-semibold">
            {listing?.title ?? (loading ? "Loading..." : "Listing")}
          </Dialog.Title>
          {#if listing}
            <Dialog.Description class="text-sm text-muted-foreground">
              {listing.tower_name}
            </Dialog.Description>
          {:else}
            <Dialog.Description class="sr-only"
              >Workshop listing</Dialog.Description
            >
          {/if}
        </div>
        <Dialog.Close class="icon-btn shrink-0" aria-label="Close">
          <X size={16} />
        </Dialog.Close>
      </div>

      {#if loading}
        <p class="p-5 text-sm text-muted-foreground">Loading details...</p>
      {:else if error}
        <p class="p-5 text-sm text-destructive">{error}</p>
      {:else if listing}
        {@const item = listing}
        <div
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.9fr)] md:overflow-hidden md:divide-x"
        >
          <div class="space-y-3 p-4 sm:space-y-4 sm:p-5 md:overflow-hidden">
            {#if imageUrl}
              <AspectRatio.Root
                ratio={16 / 9}
                class="overflow-hidden rounded-[var(--radius)_0] border bg-muted {featured
                  ? 'border-amber-500/40'
                  : 'border-border'}"
              >
                <img src={imageUrl} alt="" class="h-full w-full object-cover" />
              </AspectRatio.Root>
            {/if}

            {#if item.description}
              <p
                class="whitespace-pre-wrap text-sm text-foreground/90 md:line-clamp-6"
              >
                {item.description}
              </p>
            {/if}

            {#if item.tags.length}
              <div class="flex flex-wrap gap-1">
                {#each item.tags as tag (tag)}
                  <span
                    class="rounded-full border px-2 py-0.5 text-xs capitalize {tag ===
                    WORKSHOP_TAG_FEATURED
                      ? 'border-amber-500/50 bg-amber-500/15 font-medium text-amber-800 dark:text-amber-200'
                      : 'border-border text-muted-foreground'}">{tag}</span
                  >
                {/each}
              </div>
            {/if}

            <Separator.Root class="h-px w-full bg-border" />

            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-2.5 text-sm">
                <Avatar.Root
                  class="size-8 shrink-0 overflow-hidden rounded-full border border-border bg-muted"
                >
                  <Avatar.Image
                    src={authorAvatar ?? avatarPlaceholder}
                    alt={item.author.fandom_username}
                    class="size-full object-cover"
                  />
                  <Avatar.Fallback
                    class="flex size-full items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {item.author.fandom_username.slice(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {item.author.fandom_username}
                  </p>
                  <p
                    class="flex flex-wrap items-center gap-x-1.5 text-xs leading-none text-muted-foreground"
                  >
                    <Tip content="Views">
                      {#snippet children({ props })}
                        <span {...props} class="inline-flex items-center gap-1">
                          <Eye size={11} class="shrink-0" />
                          {item.views.toLocaleString()}
                        </span>
                      {/snippet}
                    </Tip>
                    <span aria-hidden="true">·</span>
                    <Tip
                      content={`Uploaded at ${new Date(item.created_at).toLocaleString()}`}
                    >
                      {#snippet children({ props })}
                        <span {...props} class="inline-flex items-center gap-1">
                          <CalendarPlus size={11} class="shrink-0" />
                          {timeAgo(item.created_at)}
                        </span>
                      {/snippet}
                    </Tip>
                    <span aria-hidden="true">·</span>
                    <Tip
                      content={`Updated at ${new Date(item.updated_at).toLocaleString()}`}
                    >
                      {#snippet children({ props })}
                        <span {...props} class="inline-flex items-center gap-1">
                          <CalendarClock size={11} class="shrink-0" />
                          {timeAgo(item.updated_at)}
                        </span>
                      {/snippet}
                    </Tip>
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <Toggle.Root
                  pressed={item.voted}
                  disabled={voteBusy}
                  aria-label={item.voted ? "Remove upvote" : "Upvote"}
                  title={authStore.user
                    ? item.voted
                      ? "Remove upvote"
                      : "Upvote"
                    : "Sign in to upvote"}
                  class="btn btn-sm inline-flex items-center gap-1.5 data-[state=off]:btn-outline data-[state=on]:btn-primary"
                  onPressedChange={() => void onVote()}
                >
                  <ThumbsUp size={14} />
                  {item.votes.toLocaleString()}
                </Toggle.Root>
                <a
                  class="btn btn-secondary btn-sm"
                  href={openHref}
                  title="View this build’s stats in the editor"
                >
                  View tower in Editor
                </a>
              </div>
            </div>
          </div>

          <aside
            class="flex flex-col border-t md:min-h-0 md:overflow-hidden md:border-t-0"
          >
            <div class="shrink-0 border-b px-4 py-3">
              <h3 class="text-sm font-semibold">
                Comments
                {#if comments.length}
                  <span class="font-normal text-muted-foreground"
                    >({comments.length})</span
                  >
                {/if}
              </h3>
            </div>

            <div
              class="space-y-3 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain"
            >
              {#if commentsLoading && comments.length === 0}
                <p class="text-xs text-muted-foreground">Loading comments...</p>
              {:else if commentsError}
                <p class="text-xs text-destructive">{commentsError}</p>
              {:else if comments.length === 0}
                <p class="text-xs text-muted-foreground">
                  No comments yet, why not share your thoughts?
                </p>
              {:else}
                <ul class="space-y-3">
                  {#each comments as c (c.id)}
                    <li class="flex gap-2">
                      <Avatar.Root
                        class="mt-0.5 size-6 shrink-0 overflow-hidden rounded-full border border-border bg-muted"
                      >
                        <Avatar.Image
                          src={avatars.get(c.author.fandom_userid) ??
                            avatarPlaceholder}
                          alt={c.author.fandom_username}
                          class="size-full object-cover"
                        />
                        <Avatar.Fallback
                          class="flex size-full items-center justify-center text-[10px] font-medium text-muted-foreground"
                        >
                          {c.author.fandom_username.slice(0, 2).toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <div class="min-w-0 flex-1">
                        <div
                          class="flex items-baseline justify-between gap-2 text-xs"
                        >
                          <span class="font-medium"
                            >{c.author.fandom_username}</span
                          >
                          <span class="shrink-0 text-muted-foreground"
                            >{timeAgo(c.created_at)}</span
                          >
                        </div>
                        <p
                          class="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90"
                        >
                          {c.body}
                        </p>
                        {#if c.mine}
                          <button
                            type="button"
                            class="mt-1 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                            onclick={() => askDeleteComment(c)}
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        {/if}
                      </div>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="shrink-0 space-y-2 border-t p-3 sm:p-4">
              {#if authStore.user}
                <textarea
                  class="input h-auto min-h-12 w-full resize-none py-2 text-sm"
                  placeholder="Write a comment..."
                  maxlength="1000"
                  rows="2"
                  bind:value={commentBody}
                  disabled={commentBusy}></textarea>
                <div class="flex justify-end">
                  <Btn
                    size="sm"
                    disabled={commentBusy || !commentBody.trim()}
                    onclick={onComment}
                  >
                    {commentBusy ? "Posting..." : "Post Comment"}
                  </Btn>
                </div>
              {:else}
                <p class="text-xs text-muted-foreground">
                  Sign in with Fandom to upvote or comment.
                </p>
              {/if}
            </div>
          </aside>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Alert
  bind:open={deleteOpen}
  title="Delete this comment?"
  description={deleteTarget ? "This can't be undone." : ""}
  confirmLabel="Delete"
  confirmClass="btn btn-destructive-fill text-white"
  onConfirm={confirmDeleteComment}
  onCancel={() => (deleteTarget = null)}
/>
