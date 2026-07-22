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
  }: {
    listing: WorkshopListing;
    onOpen?: (listing: WorkshopListing) => void;
    onEdit?: (listing: WorkshopListing) => void;
    onUnpublish?: (listing: WorkshopListing) => void;
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
  class="relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)_0] border bg-card transition-colors duration-250 {featured
    ? 'border-amber-500/50 bg-amber-500/4 hover:bg-amber-500/8'
    : 'border-border hover:bg-muted/40'}"
>
  <button
    type="button"
    class="absolute inset-0 z-0 cursor-pointer outline-none"
    aria-label={`Open ${listing.title}`}
    onclick={() => onOpen?.(listing)}
  ></button>

  <div class="pointer-events-none aspect-video w-full bg-muted">
    {#if imageUrl}
      <img
        src={imageUrl}
        alt=""
        class="h-full w-full object-cover"
        loading="lazy"
      />
    {:else}
      <enhanced:img
        src="$lib/assets/PlaceholderWide.png"
        alt=""
        class="h-full w-full object-cover"
      />
    {/if}
  </div>

  <div class="pointer-events-none flex flex-col gap-2 p-4 pt-1">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="truncate font-semibold">{listing.title}</h3>
        <p class="truncate text-sm text-muted-foreground">
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
      <p class="line-clamp-3 text-sm text-muted-foreground">
        {listing.description}
      </p>
    {/if}

    {#if listing.tags.length}
      <div class="flex flex-wrap gap-1">
        {#each listing.tags as tag (tag)}
          <span
            class="rounded-full border px-2 py-0.5 text-xs capitalize {tag ===
            WORKSHOP_TAG_FEATURED
              ? 'border-amber-500/50 bg-amber-500/15 font-medium text-amber-800 dark:text-amber-200'
              : 'border-border text-muted-foreground'}">{tag}</span
          >
        {/each}
      </div>
    {/if}

    <div
      class="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground"
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
      </span>
    </div>
  </div>
</article>
