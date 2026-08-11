<script lang="ts">
  import { ExternalLink } from "@lucide/svelte";
  import Modal from "$lib/components/smol/Modal.svelte";
  import CollapsibleSide from "$lib/components/smol/CollapsibleSide.svelte";
  import { announcementsStore } from "$lib/stores/announcements.svelte";
  import {
    formatAnnouncementDate,
    type Announcement,
  } from "$lib/services/announcements";

  const current = $derived(announcementsStore.items.filter((a) => !a.legacy));
  const legacy = $derived(announcementsStore.items.filter((a) => a.legacy));

  function onOpenChange(next: boolean) {
    announcementsStore.open = next;
    if (next) announcementsStore.markSeen();
  }
</script>

{#snippet entry(item: Announcement)}
  <a
    class="announce-item"
    href={item.link}
    target="_blank"
    rel="noopener noreferrer"
  >
    <div class="announce-item-head">
      <span class="announce-item-title">{item.title}</span>
      <span class="announce-item-ext" aria-hidden="true">
        <ExternalLink size={14} />
      </span>
    </div>
    <time class="announce-item-date" datetime={item.date}
      >{formatAnnouncementDate(item.date)}</time
    >
    <p class="announce-item-desc">{item.description}</p>
  </a>
{/snippet}

<Modal
  open={announcementsStore.open}
  title="Announcements"
  class="sm:max-w-lg! max-md:pb-0"
  {onOpenChange}
>
  <div class="announce-list">
    {#if !announcementsStore.loaded}
      <p class="text-sm text-muted-foreground">Loading...</p>
    {:else if announcementsStore.items.length === 0}
      <p class="text-sm text-muted-foreground">No announcements yet.</p>
    {:else}
      {#each current as item (item.link)}
        {@render entry(item)}
      {/each}
      {#if legacy.length}
        <CollapsibleSide title="Historical">
          <div class="announce-historical-body">
            {#each legacy as item (item.link)}
              {@render entry(item)}
            {/each}
          </div>
        </CollapsibleSide>
      {/if}
    {/if}
  </div>
</Modal>

<style>
  .announce-list {
    display: flex;
    max-height: min(70dvh, 28rem);
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding-bottom: 0.75rem;
  }

  .announce-item {
    display: block;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--muted);
    padding: 10px 12px;
    color: inherit;
    text-decoration: none;
    transition:
      border-color 0.1s,
      background 0.1s;

    &:hover {
      border-color: var(--border-strong);
      background: var(--secondary);
    }
  }

  .announce-item-head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .announce-item-title {
    flex: 1;
    min-width: 0;
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.25;
  }

  .announce-item-ext {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--muted-foreground);
  }

  .announce-item-date {
    display: block;
    margin-top: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--muted-foreground);
  }

  .announce-item-desc {
    margin-top: 6px;
    font-size: 0.75rem;
    line-height: 1.35;
    color: var(--muted-foreground);
  }

  .announce-historical-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
