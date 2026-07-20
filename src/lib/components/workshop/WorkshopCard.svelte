<script lang="ts">
  import { resolve } from "$app/paths";
  import { Eye, Pencil, Trash2 } from "@lucide/svelte";
  import avatarPlaceholder from "$lib/assets/Avatar.png";
  import { fetchFandomAvatar } from "$lib/services/fandomAuth";
  import { imageLoader } from "$lib/services/imageLoader";
  import {
    WORKSHOP_TAG_FEATURED,
    type WorkshopListing,
  } from "$lib/services/workshop";

  let {
    listing,
    onEdit,
    onUnpublish,
  }: {
    listing: WorkshopListing;
    onEdit?: (listing: WorkshopListing) => void;
    onUnpublish?: (listing: WorkshopListing) => void;
  } = $props();

  const openHref = $derived(
    `${resolve("/tower/[name]", { name: listing.tower_name })}?share=${encodeURIComponent(listing.share_id)}`,
  );
  const featured = $derived(listing.tags.includes(WORKSHOP_TAG_FEATURED));

  let imageUrl = $state<string | null>(null);
  let avatarSrc = $state(avatarPlaceholder);

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
    imageLoader.loadImage(listing.id, 0, ref).then((url) => {
      if (!cancelled) imageUrl = url;
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const userId = listing.author.fandom_userid;
    avatarSrc = avatarPlaceholder;
    let cancelled = false;
    fetchFandomAvatar(userId).then((url) => {
      if (!cancelled && url) avatarSrc = url;
    });
    return () => {
      cancelled = true;
    };
  });

  function timeAgo(iso: string): string {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  }
</script>

<article
  class="relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)_0] border bg-card transition-colors duration-250 {featured
    ? 'border-amber-500/50 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
    : 'border-border hover:bg-muted/40'}"
>
  {#if imageUrl}
    <div class="aspect-video w-full bg-muted">
      <img
        src={imageUrl}
        alt=""
        class="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  {/if}

  <div class="flex flex-col gap-2 p-4 pt-1">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="truncate font-semibold">
          <a
            href={openHref}
            class="outline-none after:absolute after:inset-0 after:content-['']"
            >{listing.title}</a
          >
        </h3>
        <p class="truncate text-sm text-muted-foreground">
          {listing.tower_name}
        </p>
      </div>
      {#if listing.mine && (onEdit || onUnpublish)}
        <div class="relative z-7 flex shrink-0 gap-0.5">
          {#if onEdit}
            <button
              type="button"
              class="icon-btn p-1.5"
              title="Edit"
              aria-label="Edit listing"
              onclick={() => onEdit(listing)}
            >
              <Pencil size={14} />
            </button>
          {/if}
          {#if onUnpublish}
            <button
              type="button"
              class="icon-btn p-1.5 text-destructive"
              title="Unpublish"
              aria-label="Unpublish listing"
              onclick={() => onUnpublish(listing)}
            >
              <Trash2 size={14} />
            </button>
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
              : 'border-border text-muted-foreground'}"
            >{tag}</span
          >
        {/each}
      </div>
    {/if}

    <div
      class="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground"
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <img
          src={avatarSrc}
          alt=""
          class="size-4 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
        <span class="truncate">{listing.author.fandom_username}</span>
      </span>
      <span class="flex shrink-0 items-center gap-1.5">
        <span class="flex items-center gap-1">
          <Eye size={12} />
          {listing.views.toLocaleString()}
        </span>
        <span aria-hidden="true">·</span>
        <span title={new Date(listing.created_at).toLocaleString()}
          >{timeAgo(listing.created_at)}</span
        >
      </span>
    </div>
  </div>
</article>
