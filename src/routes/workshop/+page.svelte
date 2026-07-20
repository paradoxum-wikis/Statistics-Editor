<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { ArrowLeft, Plus, Store } from "@lucide/svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import AuthMenu from "$lib/components/smol/AuthMenu.svelte";
  import Alert from "$lib/components/smol/Alert.svelte";
  import Btn from "$lib/components/smol/Btn.svelte";
  import Card from "$lib/components/smol/Card.svelte";
  import IconBtn from "$lib/components/smol/IconBtn.svelte";
  import LoadingCard from "$lib/components/smol/LoadingCard.svelte";
  import TextInput from "$lib/components/smol/TextInput.svelte";
  import WorkshopCard from "$lib/components/workshop/WorkshopCard.svelte";
  import WorkshopFormDialog from "$lib/components/workshop/WorkshopFormDialog.svelte";
  import { isAdminUser } from "$lib/services/admin";
  import { fetchFandomAvatars } from "$lib/services/fandomAuth";
  import {
    deleteWorkshopListing,
    listWorkshop,
    WORKSHOP_TAGS,
    type WorkshopListing,
    type WorkshopTag,
  } from "$lib/services/workshop";
  import { toast } from "$lib/toast";

  let items = $state<WorkshopListing[]>([]);
  let total = $state(0);
  let page = $state(1);
  let pageSize = $state(24);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let q = $state("");
  let debouncedQ = $state("");
  let tag = $state<WorkshopTag | "">("");
  let sort = $state<"new" | "views">("new");
  let mineOnly = $state(false);

  let publishOpen = $state(false);
  let editOpen = $state(false);
  let editTarget = $state<WorkshopListing | null>(null);
  let unpublishOpen = $state(false);
  let unpublishTarget = $state<WorkshopListing | null>(null);

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  let fetchSeq = 0;

  async function load() {
    const seq = ++fetchSeq;
    loading = true;
    error = null;
    try {
      const res = await listWorkshop({
        q: debouncedQ,
        tag,
        sort,
        mine: mineOnly,
        page,
      });
      if (seq !== fetchSeq) return;
      items = res.items;
      total = res.total;
      pageSize = res.page_size;
      // one bulk avatar hop for the page (cards share the session cache)
      void fetchFandomAvatars(
        res.items.map((item) => item.author.fandom_userid),
      );
    } catch (e) {
      if (seq !== fetchSeq) return;
      error = e instanceof Error ? e.message : "Failed to load Workshop.";
    } finally {
      if (seq === fetchSeq) loading = false;
    }
  }

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
    tag;
    sort;
    mineOnly;
    page;
    void load();
  });

  function chipClass(active: boolean) {
    return active
      ? "rounded-full border border-primary bg-primary px-3 py-0.5 text-xs capitalize text-primary-foreground"
      : "rounded-full border border-border px-3 py-0.5 text-xs capitalize text-muted-foreground transition-colors hover:bg-muted";
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

  function openEdit(listing: WorkshopListing) {
    editTarget = listing;
    editOpen = true;
  }

  function askUnpublish(listing: WorkshopListing) {
    unpublishTarget = listing;
    unpublishOpen = true;
  }

  async function confirmUnpublish() {
    if (!unpublishTarget) return;
    try {
      await deleteWorkshopListing(unpublishTarget.id);
      toast.success("Listing unpublished.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't unpublish.");
    } finally {
      unpublishTarget = null;
    }
  }
</script>

<svelte:head>
  <title>Workshop | TDS Statistics Editor</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
  <header
    class="sticky top-0 z-7 flex items-center justify-between gap-3 border-b bg-card p-2 px-3"
  >
    <div class="flex min-w-0 items-center gap-3">
      <IconBtn onclick={goBack} title="Back to the editor">
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

  <main class="min-h-0 flex-1 overflow-y-auto p-5">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <div class="relative w-full max-w-xs">
        <TextInput
          class="input-short pl-7"
          placeholder="Search title, tower, or author…"
          bind:value={q}
        />
      </div>

      <div class="flex flex-wrap gap-1.5">
        <button
          class={chipClass(tag === "")}
          onclick={() => ((tag = ""), (page = 1))}>All</button
        >
        {#each WORKSHOP_TAGS as t (t)}
          <button
            class={chipClass(tag === t)}
            onclick={() => ((tag = t), (page = 1))}>{t}</button
          >
        {/each}
      </div>

      <div class="ms-auto flex items-center gap-2">
        {#if authStore.user}
          <button
            class={chipClass(mineOnly)}
            onclick={() => ((mineOnly = !mineOnly), (page = 1))}>Mine</button
          >
        {/if}
        <select
          class="input input-short w-auto"
          bind:value={sort}
          onchange={() => (page = 1)}
          aria-label="Sort listings"
        >
          <option value="new">Newest</option>
          <option value="views">Most viewed</option>
        </select>
      </div>
    </div>

    {#if loading && items.length === 0}
      <LoadingCard message="Ranger is on the lookout for the Workshop..." />
    {:else if error}
      <Card class="p-8 text-center">
        <p class="text-destructive">{error}</p>
        <Btn class="mt-3" variant="outline" onclick={load}>Retry</Btn>
      </Card>
    {:else if items.length === 0}
      <Card class="space-y-2 p-8 text-center">
        <Store class="mx-auto text-muted-foreground" size={32} />
        <p class="font-medium">Nothing here yet...</p>
        <p class="text-sm text-muted-foreground">
          {mineOnly || q.trim() || tag
            ? "Perhaps, try different a filter?"
            : "Be the first to publish a build!"}
        </p>
      </Card>
    {:else}
      <div class:opacity-60={loading} class="transition-opacity">
        <div
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {#each items as item (item.id)}
            <WorkshopCard
              listing={item}
              onEdit={openEdit}
              onUnpublish={askUnpublish}
            />
          {/each}
        </div>

        {#if totalPages > 1}
          <div class="mt-4 flex items-center justify-center gap-3">
            <Btn
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onclick={() => (page -= 1)}>Previous</Btn
            >
            <span class="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Btn
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onclick={() => (page += 1)}>Next</Btn
            >
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<WorkshopFormDialog mode="create" bind:open={publishOpen} onSaved={load} />
{#if editTarget}
  <WorkshopFormDialog
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
    ? `"${unpublishTarget.title}" leaves the Workshop, but the share link will still keep working.`
    : ""}
  confirmLabel="Unpublish"
  confirmClass="btn btn-destructive-fill text-white"
  onConfirm={confirmUnpublish}
  onCancel={() => (unpublishTarget = null)}
/>
