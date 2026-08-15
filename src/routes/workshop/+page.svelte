<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { fade } from "svelte/transition";
  import { Select } from "bits-ui";
  import {
    ArrowLeft,
    Check,
    ChevronDown,
    Earth,
    Plus,
    Sprout,
    Scale,
    Search,
    PencilSparkles,
    Store,
    UserRound,
    Wrench,
  } from "@lucide/svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import AuthMenu from "$lib/components/smol/AuthMenu.svelte";
  import Alert from "$lib/components/smol/Alert.svelte";
  import Btn from "$lib/components/smol/Btn.svelte";
  import Card from "$lib/components/smol/Card.svelte";
  import IconBtn from "$lib/components/smol/IconBtn.svelte";
  import LoadingCard from "$lib/components/smol/LoadingCard.svelte";
  import Separator from "$lib/components/smol/Separator.svelte";
  import TextInput from "$lib/components/smol/TextInput.svelte";
  import WorkshopCard from "$lib/components/workshop/WorkshopCard.svelte";
  import WorkshopDetailModal from "$lib/components/workshop/WorkshopDetailModal.svelte";
  import WorkshopFormModal from "$lib/components/workshop/WorkshopFormModal.svelte";
  import WorkshopSpotlight from "$lib/components/workshop/WorkshopSpotlight.svelte";
  import { isAdminUser } from "$lib/services/admin";
  import { fetchFandomAvatars } from "$lib/services/fandomAuth";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import {
    deleteWorkshopListing,
    listWorkshop,
    WORKSHOP_TAG_FEATURED,
    type WorkshopListing,
    type WorkshopListingTag,
  } from "$lib/services/workshop";
  import { toast } from "$lib/toast";

  const SORT_OPTIONS = [
    { value: "new", label: "Newest" },
    { value: "views", label: "Most Viewed" },
    { value: "votes", label: "Most Upvoted" },
  ] as const;

  let items = $state<WorkshopListing[]>([]);
  let spotlight = $state<WorkshopListing[]>([]);
  let total = $state(0);
  let page = $state(1);
  let pageSize = $state(20);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let q = $state("");
  let debouncedQ = $state("");
  let tags = $state<WorkshopListingTag[]>([]);
  let sort = $state<"new" | "views" | "votes">("new");
  let mineOnly = $state(false);

  const sortLabel = $derived(SORT_OPTIONS.find((o) => o.value === sort)!.label);
  const activeBrowse = $derived(
    mineOnly ? "mine" : tags.length === 1 ? tags[0] : "all",
  );
  const sectionTitle = $derived(
    activeBrowse === "mine"
      ? "Your Towers"
      : activeBrowse === WORKSHOP_TAG_FEATURED
        ? "Featured Towers"
        : activeBrowse === "rework"
          ? "Reworked Towers"
          : activeBrowse === "rebalance"
            ? "Rebalanced Towers"
            : activeBrowse === "new"
              ? "New Towers"
              : "Explore All That There Is!",
  );

  let publishOpen = $state(false);
  let editOpen = $state(false);
  let editTarget = $state<WorkshopListing | null>(null);
  let unpublishOpen = $state(false);
  let unpublishTarget = $state<WorkshopListing | null>(null);
  let detailOpen = $state(false);
  let detailId = $state<string | null>(null);

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  let fetchSeq = 0;

  async function loadSpotlight() {
    const res = await listWorkshop({ spotlight: true });
    spotlight = res.items;
    void fetchFandomAvatars(res.items.map((i) => i.author.fandom_userid)).catch(
      (e) => {
        if (settingsStore.debugMode) console.error("[workshop] avatars", e);
      },
    );
  }

  async function load() {
    const seq = ++fetchSeq;
    loading = true;
    error = null;
    try {
      const res = await listWorkshop({
        q: debouncedQ,
        tags,
        sort,
        mine: mineOnly,
        page,
      });
      if (seq !== fetchSeq) return;
      items = res.items;
      total = res.total;
      pageSize = res.page_size;
      void fetchFandomAvatars(
        res.items.map((item) => item.author.fandom_userid),
      ).catch((e) => {
        if (settingsStore.debugMode) console.error("[workshop] avatars", e);
      });
    } catch (e) {
      if (seq !== fetchSeq) return;
      if (settingsStore.debugMode) console.error("[workshop] list", e);
      error = e instanceof Error ? e.message : "Failed to load Workshop.";
    } finally {
      if (seq === fetchSeq) loading = false;
    }
  }

  $effect(() => {
    void loadSpotlight().catch((e) => {
      if (settingsStore.debugMode) console.error("[workshop] spotlight", e);
    });
  });

  $effect(() => {
    const value = q;
    const t = setTimeout(() => {
      debouncedQ = value;
      page = 1;
    }, 250);
    return () => clearTimeout(t);
  });

  $effect(() => {
    debouncedQ;
    tags;
    sort;
    mineOnly;
    page;
    void load();
  });

  function selectBrowse(value: "all" | "mine" | WorkshopListingTag) {
    mineOnly = value === "mine";
    tags = value === "all" || value === "mine" ? [] : [value];
    page = 1;
  }

  async function goBack() {
    if (towerStore.selectedName) {
      await goto(resolve("/tower/[name]", { name: towerStore.selectedName }), {
        keepFocus: true,
        noScroll: true,
      });
      return;
    }
    await goto(resolve("/"), { keepFocus: true, noScroll: true });
  }

  function openDetail(listing: WorkshopListing) {
    detailId = listing.id;
    detailOpen = true;
  }

  function openEdit(listing: WorkshopListing) {
    editTarget = listing;
    editOpen = true;
  }

  function askUnpublish(listing: WorkshopListing) {
    unpublishTarget = listing;
    unpublishOpen = true;
  }

  function onDetailChanged(listing: WorkshopListing) {
    const patch = (it: WorkshopListing) =>
      it.id === listing.id ? { ...it, ...listing } : it;
    items = items.map(patch);
    spotlight = spotlight.map(patch);
  }

  async function confirmUnpublish() {
    if (!unpublishTarget) return;
    try {
      await deleteWorkshopListing(unpublishTarget.id);
      toast.success("Listing unpublished.");
      await load();
    } catch (e) {
      if (settingsStore.debugMode) console.error("[workshop] unpublish", e);
      toast.error(e instanceof Error ? e.message : "Couldn't unpublish.");
    } finally {
      unpublishTarget = null;
    }
  }
</script>

<svelte:head>
  <title>Workshop · TDS Statistics Editor</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background" in:fade={{ duration: 140 }}>
  <header
    class="sticky top-0 z-7 flex items-center justify-between gap-3 border-b bg-card p-2 px-3"
  >
    <div class="flex min-w-0 items-center gap-3">
      <IconBtn onclick={goBack} title="Back to Editor">
        <ArrowLeft size={18} />
      </IconBtn>
      <h1 class="unisans truncate text-3xl font-black text-foreground">
        Workshop
      </h1>
    </div>
    <div class="flex shrink-0 items-center space-x-2">
      {#if isAdminUser(authStore.user)}
        <Btn variant="outline" onclick={() => goto(resolve("/admin"))}>
          Admin
        </Btn>
      {/if}
      <Btn variant="secondary" onclick={() => (publishOpen = true)}>
        <span class="inline-flex items-center gap-1.5">
          <Plus size={14} />
          <span class="max-md:hidden">Publish</span>
        </span>
      </Btn>
      <AuthMenu />
    </div>
  </header>

  <main class="workshop-scroll">
    <div class="workshop-shell">
      <aside class="browse-rail" aria-label="Workshop categories">
        <nav class="browse-nav">
          <button
            class={activeBrowse === "all" ? "active" : undefined}
            aria-pressed={activeBrowse === "all"}
            onclick={() => selectBrowse("all")}
          >
            <span class="filter-icon all"
              ><Earth size={32} class="relative z-7" /></span
            >
            <span>All</span>
          </button>
          <button
            class={activeBrowse === WORKSHOP_TAG_FEATURED
              ? "active"
              : undefined}
            aria-pressed={activeBrowse === WORKSHOP_TAG_FEATURED}
            onclick={() => selectBrowse(WORKSHOP_TAG_FEATURED)}
          >
            <span class="filter-icon featured"
              ><PencilSparkles size={32} class="relative z-7" /></span
            >
            <span>Featured</span>
          </button>
          <button
            class={activeBrowse === "rework" ? "active" : undefined}
            aria-pressed={activeBrowse === "rework"}
            onclick={() => selectBrowse("rework")}
          >
            <span class="filter-icon rework"
              ><Wrench size={32} class="relative z-7" /></span
            >
            <span>Rework</span>
          </button>
          <button
            class={activeBrowse === "rebalance" ? "active" : undefined}
            aria-pressed={activeBrowse === "rebalance"}
            onclick={() => selectBrowse("rebalance")}
          >
            <span class="filter-icon rebalance"
              ><Scale size={32} class="relative z-7" /></span
            >
            <span>Rebalance</span>
          </button>
          <button
            class={activeBrowse === "new" ? "active" : undefined}
            aria-pressed={activeBrowse === "new"}
            onclick={() => selectBrowse("new")}
          >
            <span class="filter-icon new"
              ><Sprout size={34} class="relative z-7" /></span
            >
            <span>New</span>
          </button>
          {#if authStore.user}
            <button
              class={activeBrowse === "mine" ? "active" : undefined}
              aria-pressed={activeBrowse === "mine"}
              onclick={() => selectBrowse("mine")}
            >
              <span class="filter-icon mine"
                ><UserRound size={32} class="relative z-7" /></span
              >
              <span>Mine</span>
            </button>
          {/if}
        </nav>
      </aside>

      <div class="workshop-content">
        {#if spotlight.length}
          <WorkshopSpotlight items={spotlight} onOpen={openDetail} />
          <Separator class="mb-5" />
        {/if}

        <section aria-labelledby="catalog-title">
          <div class="catalog-heading">
            <h2 id="catalog-title">{sectionTitle}</h2>
            <div class="catalog-tools">
              <div class="search-box">
                <Search
                  size={15}
                  class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                />
                <TextInput
                  class="short pl-8!"
                  placeholder="Search title, towers, or creators..."
                  aria-label="Search Workshop"
                  bind:value={q}
                />
              </div>

              <Select.Root
                type="single"
                items={[...SORT_OPTIONS]}
                value={sort}
                onValueChange={(val) => {
                  if (!val || val === sort) return;
                  sort = val as typeof sort;
                  page = 1;
                }}
              >
                <Select.Trigger
                  class="select-trigger w-auto gap-1.5"
                  aria-label="Sort listings"
                >
                  <span class="truncate">{sortLabel}</span>
                  <ChevronDown class="size-3.5 shrink-0 opacity-50" />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    class="select-content min-w-36"
                    sideOffset={6}
                  >
                    <Select.Viewport class="p-1">
                      {#each SORT_OPTIONS as option (option.value)}
                        <Select.Item
                          class="select-item"
                          value={option.value}
                          label={option.label}
                        >
                          {#snippet children({ selected })}
                            {option.label}
                            {#if selected}
                              <Check class="ms-auto size-3.5 shrink-0" />
                            {/if}
                          {/snippet}
                        </Select.Item>
                      {/each}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>

          {#if loading && items.length === 0}
            <LoadingCard
              message="Ranger is on the lookout for the Workshop..."
            />
          {:else if error}
            <Card class="p-8 text-center">
              <p class="text-destructive">{error}</p>
              <Btn class="mt-3" variant="outline" onclick={load}>Retry</Btn>
            </Card>
          {:else if items.length === 0}
            <Card class="empty-state">
              <Store size={34} class="text-muted-foreground" />
              <h3 class="mt-1 font-extrabold">Nothing here yet</h3>
              <p class="text-xs text-muted-foreground">
                {mineOnly || q.trim() || tags.length
                  ? "Try another category or a broader search."
                  : "Be the first to publish a build!"}
              </p>
            </Card>
          {:else}
            <div class:loading class="results">
              <div class="listing-grid">
                {#each items as item (item.id)}
                  <WorkshopCard
                    listing={item}
                    onOpen={openDetail}
                    onEdit={openEdit}
                    onUnpublish={askUnpublish}
                  />
                {/each}
              </div>

              {#if totalPages > 1}
                <div class="pagination">
                  <Btn
                    variant="outline"
                    disabled={page <= 1}
                    onclick={() => (page -= 1)}>Previous</Btn
                  >
                  <span>Page {page} of {totalPages}</span>
                  <Btn
                    variant="outline"
                    disabled={page >= totalPages}
                    onclick={() => (page += 1)}>Next</Btn
                  >
                </div>
              {/if}
            </div>
          {/if}
        </section>
      </div>
    </div>
  </main>
</div>

<WorkshopDetailModal
  bind:open={detailOpen}
  bind:listingId={detailId}
  onChanged={onDetailChanged}
/>

<WorkshopFormModal mode="create" bind:open={publishOpen} onSaved={load} />
{#if editTarget}
  <WorkshopFormModal
    mode="edit"
    listing={editTarget}
    bind:open={editOpen}
    onSaved={load}
  />
{/if}

<Alert
  bind:open={unpublishOpen}
  title="Unpublish this listing?"
  description={unpublishTarget
    ? `“${unpublishTarget.title}” leaves the Workshop, but the share link will still keep working.`
    : ""}
  confirmLabel="Unpublish"
  confirmClass="btn destructive-fill text-white"
  onConfirm={confirmUnpublish}
  onCancel={() => (unpublishTarget = null)}
/>

<style>
  .workshop-scroll {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
  }

  .workshop-shell {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    gap: 1.5rem;
    width: min(100%, 86rem);
    margin-inline: auto;
    padding: 1rem;

    @media (max-width: 800px) {
      display: block;
      padding: 0.75rem;
    }
  }

  .browse-rail {
    position: sticky;
    top: 1rem;
    align-self: start;
    overflow: hidden;
    border: 2px solid var(--border-strong);
    border-radius: calc(var(--radius) + 0.45rem);
    background: var(--card);

    @media (max-width: 800px) {
      position: static;
      margin-bottom: 0.75rem;
      overflow-x: auto;
      border-radius: 1rem;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  }

  .browse-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.45rem;

    button {
      position: relative;
      display: flex;
      --filter-color: var(--muted-foreground);
      width: 4.45rem;
      min-height: 4.65rem;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border: 0;
      padding: 0;
      background: transparent;
      color: var(--foreground);

      > span:last-child {
        position: absolute;
        right: 0;
        bottom: 0.1rem;
        left: 0;
        overflow: hidden;
        padding-inline: 0.1rem;
        color: oklch(1 0 0);
        font-size: 0.74rem;
        font-weight: 800;
        line-height: 1.2;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
        -webkit-text-stroke: calc(var(--text-stroke-width) + 1px)
          var(--text-stroke-color);
        paint-order: stroke fill;
      }

      &:has(.all) {
        --filter-color: var(--tower-advanced);
      }

      &:has(.featured) {
        --filter-color: var(--tower-exclusive);
      }

      &:has(.rework) {
        --filter-color: var(--tower-unavailable);
      }

      &:has(.rebalance) {
        --filter-color: var(--tower-hardcore);
      }

      &:has(.new) {
        --filter-color: var(--tower-evolved);
      }

      &:has(.mine) {
        --filter-color: var(--tower-starter);
      }

      &:hover .filter-icon,
      &.active .filter-icon {
        color: oklch(1 0 0);

        &::before {
          border-color: var(--filter-color);
        }

        &::after {
          background: var(--filter-color);
        }
      }

      &.active {
        cursor: default;
      }
    }

    @media (max-width: 800px) {
      width: max-content;
      min-width: 100%;
      flex-direction: row;
      justify-content: center;
      padding: 0.4rem 0.55rem;
    }
  }

  .filter-icon {
    position: relative;
    isolation: isolate;
    display: flex;
    width: 4.35rem;
    height: 4.35rem;
    align-items: center;
    justify-content: center;
    color: var(--filter-color);

    &::before,
    &::after {
      content: "";
      position: absolute;
      rotate: 4deg;
      pointer-events: none;
    }

    &::before {
      inset: 0;
      border: 2px solid var(--border);
      border-radius: 0.65rem;
      background: var(--card);
      transition: border-color 0.12s;
    }

    &::after {
      inset: 0.42rem;
      border-radius: calc(var(--radius) - 0.1rem);
      background: var(--border);
      transition: background 0.12s;
    }
  }

  .workshop-content {
    min-width: 0;
  }

  .catalog-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.8rem;

    h2 {
      font-size: 1.3rem;
      font-weight: 800;
      line-height: 1.15;
    }

    @media (max-width: 960px) {
      align-items: stretch;
      flex-direction: column;
    }
  }

  .catalog-tools {
    display: flex;
    align-items: center;
    gap: 0.45rem;

    @media (max-width: 520px) {
      align-items: stretch;
      flex-direction: column;
    }
  }

  .search-box {
    position: relative;
    width: min(19rem, 42vw);

    @media (max-width: 960px) {
      width: 100%;
    }
  }

  .results {
    transition: opacity 0.15s;

    &.loading {
      opacity: 0.55;
    }
  }

  .listing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 3rem;
    text-align: center;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;

    span {
      color: var(--muted-foreground);
      font-size: 0.75rem;
    }
  }
</style>
