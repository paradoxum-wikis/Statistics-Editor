<script lang="ts">
  import { Avatar } from "bits-ui";
  import { CalendarClock, Eye, Pencil, ThumbsUp, Trash2 } from "@lucide/svelte";
  import avatarPlaceholder from "$lib/assets/Avatar.png";
  import { fetchFandomAvatar } from "$lib/services/fandomAuth";
  import { imageLoader } from "$lib/services/imageLoader";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import {
    WORKSHOP_TAG_FEATURED,
    type WorkshopListing,
  } from "$lib/services/workshop";
  import { timeAgo } from "$lib/utils/workshop";
  import IconBtn from "../smol/IconBtn.svelte";
  import Tip from "../smol/Tip.svelte";

  let {
    listing,
    onOpen,
    onEdit,
    onUnpublish,
    compact = false,
  }: {
    listing: WorkshopListing;
    onOpen?: (listing: WorkshopListing) => void;
    onEdit?: (listing: WorkshopListing) => void;
    onUnpublish?: (listing: WorkshopListing) => void;
    compact?: boolean;
  } = $props();

  const featured = $derived(listing.tags.includes(WORKSHOP_TAG_FEATURED));

  let imageUrl = $state<string | null>(null);
  let avatarSrc = $state<string | null>(null);

  $effect(() => {
    const ref = listing.image?.trim();
    if (!ref) {
      imageUrl = null;
      return;
    }
    const cached = imageLoader.getCachedUrl(listing.id, 0, ref);
    if (cached) {
      imageUrl = cached;
      return;
    }
    let cancelled = false;
    imageLoader
      .loadImage(listing.id, 0, ref)
      .then((url) => {
        if (!cancelled) imageUrl = url;
      })
      .catch((e) => {
        if (settingsStore.debugMode) console.error("[workshop] card image", e);
        if (!cancelled) imageUrl = null;
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const userId = listing.author.fandom_userid;
    avatarSrc = null;
    let cancelled = false;
    fetchFandomAvatar(userId)
      .then((url) => {
        if (!cancelled && url) avatarSrc = url;
      })
      .catch((e) => {
        if (settingsStore.debugMode) console.error("[workshop] card avatar", e);
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<article
  class="relative flex overflow-hidden rounded-[var(--radius)_0] border bg-card transition-colors duration-250 {compact
    ? 'flex-row gap-0'
    : 'flex-col gap-2'} {featured
    ? 'border-amber-500/50 bg-amber-500/4 hover:bg-amber-500/8'
    : 'border-border hover:bg-muted/40'}"
>
  <button
    type="button"
    class="absolute inset-0 z-0 cursor-pointer outline-none"
    aria-label={`Open ${listing.title}`}
    onclick={() => onOpen?.(listing)}
  ></button>

  <div
    class="pointer-events-none relative shrink-0 bg-muted {compact
      ? 'w-[38%] min-h-24 self-stretch sm:w-[34%]'
      : 'aspect-video w-full'}"
  >
    {#if imageUrl}
      <img
        src={imageUrl}
        alt=""
        class="h-full w-full object-cover {compact ? 'absolute inset-0' : ''}"
        loading="lazy"
      />
    {:else}
      <enhanced:img
        src="$lib/assets/PlaceholderWide.png"
        alt=""
        class="h-full w-full object-cover {compact ? 'absolute inset-0' : ''}"
      />
    {/if}
    {#if !compact && listing.tags.length}
      <div
        class="absolute top-2 right-2 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1"
      >
        {#each listing.tags as tag (tag)}
          <span
            class="rounded-full border px-2 py-0.5 text-xs capitalize backdrop-blur-xs {tag ===
            WORKSHOP_TAG_FEATURED
              ? 'border-amber-500/50 bg-amber-100/70 font-medium text-amber-900 dark:bg-amber-950/70 dark:text-amber-100'
              : 'border-border bg-card/70 text-muted-foreground'}">{tag}</span
          >
        {/each}
      </div>
    {/if}
  </div>

  <div
    class="pointer-events-none flex min-w-0 flex-1 flex-col {compact
      ? 'justify-center gap-1 p-2.5 sm:p-3'
      : 'gap-2 p-4 pt-1'}"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="truncate font-semibold {compact ? 'text-sm' : ''}">
          {listing.title}
        </h3>
        <p
          class="truncate text-muted-foreground {compact
            ? 'text-xs'
            : 'text-sm'}"
        >
          {listing.tower_name}
        </p>
      </div>
      {#if listing.mine && (onEdit || onUnpublish)}
        <div class="pointer-events-auto relative z-7 flex shrink-0 gap-0.5">
          {#if onEdit}
            <IconBtn
              class="p-1.5"
              title="Edit"
              aria-label="Edit listing"
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                onEdit(listing);
              }}
            >
              <Pencil size={14} />
            </IconBtn>
          {/if}
          {#if onUnpublish}
            <IconBtn
              class="p-1.5 text-destructive"
              title="Unpublish"
              aria-label="Unpublish listing"
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                onUnpublish(listing);
              }}
            >
              <Trash2 size={14} />
            </IconBtn>
          {/if}
        </div>
      {/if}
    </div>

    {#if listing.description}
      <p
        class="text-muted-foreground {compact
          ? 'line-clamp-1 text-xs'
          : 'line-clamp-3 text-sm'}"
      >
        {listing.description}
      </p>
    {/if}

    {#if compact && listing.tags.length}
      <div class="flex flex-wrap gap-1">
        {#each listing.tags as tag (tag)}
          <span
            class="rounded-full border px-1.5 py-0.5 text-[0.65rem] capitalize {tag ===
            WORKSHOP_TAG_FEATURED
              ? 'border-amber-500/50 bg-amber-100/70 font-medium text-amber-900 dark:bg-amber-950/70 dark:text-amber-100'
              : 'border-border bg-muted/70 text-muted-foreground'}">{tag}</span
          >
        {/each}
      </div>
    {/if}

    <div
      class="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground {compact
        ? 'pt-0.5'
        : 'pt-1'}"
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <Avatar.Root
          class="size-4 shrink-0 overflow-hidden rounded-full border border-border bg-muted"
        >
          <Avatar.Image
            src={avatarSrc ?? avatarPlaceholder}
            alt=""
            class="size-full object-cover"
          />
          <Avatar.Fallback
            class="flex size-full items-center justify-center text-[8px] font-medium text-muted-foreground"
          >
            {listing.author.fandom_username.slice(0, 2).toUpperCase()}
          </Avatar.Fallback>
        </Avatar.Root>
        <span class="truncate">{listing.author.fandom_username}</span>
      </span>
      <span
        class="pointer-events-auto relative z-7 flex shrink-0 items-center gap-1.5 leading-none"
      >
        <Tip content={listing.voted ? "You upvoted this" : "Upvotes"}>
          {#snippet children({ props })}
            <span
              {...props}
              class="inline-flex items-center gap-1 {listing.voted
                ? 'text-sky-600 dark:text-sky-400'
                : ''}"
            >
              <ThumbsUp size={12} class="shrink-0" />
              {listing.votes.toLocaleString()}
            </span>
          {/snippet}
        </Tip>
        <span class="leading-none" aria-hidden="true">·</span>
        <Tip content="Views">
          {#snippet children({ props })}
            <span {...props} class="inline-flex items-center gap-1">
              <Eye size={12} class="shrink-0" />
              {listing.views.toLocaleString()}
            </span>
          {/snippet}
        </Tip>
        {#if !compact}
          <span class="leading-none" aria-hidden="true">·</span>
          <Tip
            content={`Updated ${new Date(listing.updated_at).toLocaleString()}`}
          >
            {#snippet children({ props })}
              <span {...props} class="inline-flex items-center gap-1">
                <CalendarClock size={12} class="shrink-0" />
                {timeAgo(listing.updated_at)}
              </span>
            {/snippet}
          </Tip>
        {/if}
      </span>
    </div>
  </div>
</article>
