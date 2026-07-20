<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { ArrowLeft, Trash2 } from "@lucide/svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import AuthMenu from "$lib/components/smol/AuthMenu.svelte";
  import Alert from "$lib/components/smol/Alert.svelte";
  import Btn from "$lib/components/smol/Btn.svelte";
  import Card from "$lib/components/smol/Card.svelte";
  import IconBtn from "$lib/components/smol/IconBtn.svelte";
  import LoadingCard from "$lib/components/smol/LoadingCard.svelte";
  import NotFoundView from "$lib/components/NotFoundView.svelte";
  import TextInput from "$lib/components/smol/TextInput.svelte";
  import {
    hardDeleteAdminListing,
    isAdminUser,
    listAdminWorkshop,
    listingIsFeatured,
    setAdminListingFeatured,
    setAdminListingPublished,
    type AdminListing,
  } from "$lib/services/admin";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { toast } from "$lib/toast";

  let items = $state<AdminListing[]>([]);
  let total = $state(0);
  let page = $state(1);
  let pageSize = $state(24);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let q = $state("");
  let debouncedQ = $state("");
  let status = $state<"all" | "published" | "hidden">("all");

  let deleteTarget = $state<AdminListing | null>(null);
  let deleteOpen = $state(false);

  const allowed = $derived(isAdminUser(authStore.user));
  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  let fetchSeq = 0;

  async function load() {
    if (!allowed) {
      loading = false;
      return;
    }
    const seq = ++fetchSeq;
    loading = true;
    error = null;
    try {
      const res = await listAdminWorkshop({
        q: debouncedQ,
        status,
        page,
      });
      if (seq !== fetchSeq) return;
      items = res.items;
      total = res.total;
      pageSize = res.page_size;
    } catch (e) {
      if (seq !== fetchSeq) return;
      if (settingsStore.debugMode) console.error("[admin] list", e);
      error = e instanceof Error ? e.message : "Failed to load admin list.";
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
    authStore.ready;
    authStore.user;
    debouncedQ;
    status;
    page;
    void load();
  });

  async function togglePublished(item: AdminListing) {
    try {
      await setAdminListingPublished(item.id, !item.published);
      toast.success(item.published ? "Hidden." : "Published.");
      await load();
    } catch (e) {
      if (settingsStore.debugMode) console.error("[admin] published", e);
      toast.error(e instanceof Error ? e.message : "Update failed.");
    }
  }

  async function toggleFeatured(item: AdminListing) {
    const next = !listingIsFeatured(item);
    try {
      await setAdminListingFeatured(item.id, next);
      toast.success(next ? "Featured." : "Unfeatured.");
      await load();
    } catch (e) {
      if (settingsStore.debugMode) console.error("[admin] featured", e);
      toast.error(e instanceof Error ? e.message : "Update failed.");
    }
  }

  function askHardDelete(item: AdminListing) {
    deleteTarget = item;
    deleteOpen = true;
  }

  async function confirmHardDelete() {
    if (!deleteTarget) return;
    try {
      await hardDeleteAdminListing(deleteTarget.id);
      toast.success("Listing deleted (share freed).");
      await load();
    } catch (e) {
      if (settingsStore.debugMode) console.error("[admin] delete", e);
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      deleteTarget = null;
    }
  }

  async function goHome() {
    await goto(resolve("/"), { keepFocus: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>
    {authStore.ready && !allowed
      ? "403 Forbidden | TDS Statistics Editor"
      : "Admin | TDS Statistics Editor"}
  </title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if !authStore.ready}
  <div class="flex h-screen items-center justify-center bg-background p-5">
    <LoadingCard message="Loading..." />
  </div>
{:else if !allowed}
  <div class="flex h-screen flex-col bg-background">
    <main class="min-h-0 flex-1 overflow-y-auto p-5">
      <NotFoundView onHome={goHome} code={403} />
    </main>
  </div>
{:else}
  <div class="flex h-screen flex-col bg-background">
    <header
      class="sticky top-0 z-7 flex items-center justify-between gap-3 border-b bg-card p-2 px-3"
    >
      <div class="flex min-w-0 items-center gap-3">
        <IconBtn
          onclick={() => goto(resolve("/workshop"))}
          title="Back to Workshop"
        >
          <ArrowLeft size={18} />
        </IconBtn>
        <h1 class="unisans truncate text-3xl font-black text-foreground">
          Admin
        </h1>
      </div>
      <AuthMenu />
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto p-5">
      {#if loading && items.length === 0}
        <LoadingCard message="Loading..." />
      {:else if error}
        <Card class="p-8 text-center">
          <p class="text-destructive">{error}</p>
          <Btn class="mt-3" variant="outline" onclick={load}>Retry</Btn>
        </Card>
      {:else}
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <TextInput
            class="input-short max-w-xs"
            placeholder="Search title, tower, author, ids..."
            bind:value={q}
          />
          <select
            class="input input-short w-auto"
            bind:value={status}
            onchange={() => (page = 1)}
            aria-label="Status filter"
          >
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </select>
          <span class="text-sm text-muted-foreground">{total} listings</span>
        </div>

        <div
          class="overflow-x-auto rounded-[var(--radius)_0] border border-border"
        >
          <table class="w-full min-w-160 text-left text-sm">
            <thead class="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">Title</th>
                <th class="px-3 py-2 font-medium">Tower</th>
                <th class="px-3 py-2 font-medium">Author</th>
                <th class="px-3 py-2 font-medium">Views</th>
                <th class="px-3 py-2 font-medium">Status</th>
                <th class="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each items as item (item.id)}
                <tr class="border-b border-border last:border-0">
                  <td class="max-w-48 truncate px-3 py-2 font-medium">
                    {item.title}
                    <div class="font-mono text-xs text-muted-foreground">
                      {item.id} · {item.share_id}
                    </div>
                  </td>
                  <td class="max-w-32 truncate px-3 py-2">{item.tower_name}</td>
                  <td class="max-w-32 truncate px-3 py-2">
                    {item.author.fandom_username}
                  </td>
                  <td class="px-3 py-2 tabular-nums"
                    >{item.views.toLocaleString()}</td
                  >
                  <td class="px-3 py-2">
                    <div class="flex flex-wrap gap-1">
                      <span
                        class="rounded-full border px-2 py-0.5 text-xs {item.published
                          ? 'border-border text-foreground'
                          : 'border-destructive/40 text-destructive'}"
                      >
                        {item.published ? "live" : "hidden"}
                      </span>
                      {#if listingIsFeatured(item)}
                        <span
                          class="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200"
                          >featured</span
                        >
                      {/if}
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex flex-wrap gap-1">
                      <Btn
                        size="sm"
                        variant="outline"
                        onclick={() => togglePublished(item)}
                      >
                        {item.published ? "Hide" : "Show"}
                      </Btn>
                      <Btn
                        size="sm"
                        variant="outline"
                        class={listingIsFeatured(item)
                          ? "border-amber-500/50 text-amber-800 dark:text-amber-200"
                          : ""}
                        onclick={() => toggleFeatured(item)}
                      >
                        {listingIsFeatured(item) ? "Unfeature" : "Feature"}
                      </Btn>
                      <Btn
                        size="sm"
                        variant="outline"
                        class="text-destructive"
                        onclick={() => askHardDelete(item)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td
                    colspan="6"
                    class="px-3 py-8 text-center text-muted-foreground"
                    >Nothing here.</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
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
      {/if}
    </main>
  </div>

  <Alert
    bind:open={deleteOpen}
    title="Hard-delete this listing?"
    description={deleteTarget
      ? `"${deleteTarget.title}" is removed permanently. The share id can be published again.`
      : ""}
    confirmLabel="Delete forever"
    confirmClass="btn btn-destructive-fill text-white"
    onConfirm={confirmHardDelete}
    onCancel={() => (deleteTarget = null)}
  />
{/if}
