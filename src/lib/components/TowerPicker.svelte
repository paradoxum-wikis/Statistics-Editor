<script lang="ts">
  import { Combobox } from "bits-ui";
  import { Check, ChevronsUpDown, X } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    buildMetaMap,
    groupedTowerNames,
  } from "$lib/towerComponents/towers";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";
  import { analytics } from "$lib/services/analytics";
  import TextInput from "./smol/TextInput.svelte";
  import TowerCard from "./TowerCard.svelte";

  let {
    variant,
    onSelect,
    selected,
    class: className,
  }: {
    variant: "home" | "compact";
    onSelect: (name: string) => void;
    selected?: string;
    class?: string;
  } = $props();

  let query = $state("");
  let open = $state(false);

  const items = $derived(
    towerStore.names.map((name) => ({ value: name, label: name })),
  );

  const filteredItems = $derived(
    query === ""
      ? items
      : items.filter((item) =>
          item.label.toLowerCase().includes(query.toLowerCase()),
        ),
  );

  const metaMap = $derived.by(() => {
    void towerStore.refreshTrigger;
    return buildMetaMap(profileStore.current, {
      towerName: towerStore.selectedName,
      wikitext: towerStore.effectiveWikitext,
    });
  });

  const groups = $derived(
    groupedTowerNames(towerStore.names, query, metaMap),
  );

  const recent = $derived(
    towerStore.recentNames.filter((name) => towerStore.names.includes(name)),
  );

  function pick(name: string) {
    if (!name || name === selected) return;
    if (query.trim()) {
      analytics.track("search", { search_term: query.trim() });
    }
    onSelect(name);
    if (variant === "compact") {
      query = "";
      open = false;
    }
  }
</script>

{#if variant === "compact"}
  <Combobox.Root
    type="single"
    allowDeselect={false}
    {items}
    value={selected}
    bind:open
    onValueChange={(v) => pick(v ?? "")}
    onOpenChange={(isOpen) => {
      if (!isOpen) query = "";
    }}
  >
    <div class="relative">
      <Combobox.Input
        placeholder="Select a tower..."
        class="combobox-input max-md:w-[90dvw]!"
        oninput={(e) => {
          query = e.currentTarget.value;
          open = true;
        }}
        onclick={() => (open = true)}
      />
      <Combobox.Trigger class="absolute top-1/2 right-3 -translate-y-1/2">
        <ChevronsUpDown class="h-4 w-4 opacity-50" />
      </Combobox.Trigger>
    </div>

    <Combobox.Portal>
      <Combobox.Content class="combobox-content" sideOffset={6}>
        <Combobox.Viewport class="max-h-75 overflow-y-auto p-2">
          {#each filteredItems as item (item.value)}
            <Combobox.Item
              class="combobox-item"
              value={item.value}
              label={item.label}
            >
              {#snippet children({ selected: isSelected })}
                {item.label}
                {#if isSelected}
                  <span
                    class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"
                  >
                    <Check class="h-4 w-4" />
                  </span>
                {/if}
              {/snippet}
            </Combobox.Item>
          {:else}
            <span class="block px-4 py-2 text-sm text-muted-foreground">
              No results found
            </span>
          {/each}
        </Combobox.Viewport>
      </Combobox.Content>
    </Combobox.Portal>
  </Combobox.Root>
{:else}
  <div class={["flex min-h-0 flex-1 flex-col gap-3", className]}>
    <TextInput
      type="search"
      placeholder="Enter a tower name!"
      bind:value={query}
    />

    <div
      class="min-h-0 max-h-[min(60vh,36rem)] flex-1 overflow-y-auto rounded-md border border-border bg-card md:max-h-none"
    >
      {#if !query && recent.length > 0}
        <section class="p-2">
          <h3>Recent</h3>
          <ul class="flex flex-wrap gap-2.5">
            {#each recent as name (name)}
              <li
                class="group relative"
                out:slide={{ duration: 177, easing: cubicOut, axis: "x" }}
              >
                <TowerCard
                  {name}
                  tier={metaMap.get(name)?.category}
                  image={metaMap.get(name)?.image}
                  onclick={() => pick(name)}
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 z-17 rounded-sm bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  aria-label="Remove {name} from recents"
                  onclick={() => towerStore.removeRecent(name)}
                >
                  <X class="size-3.5" />
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#each groups as group (group.label)}
        <section class="p-2">
          <h3>{group.label}</h3>
          <ul class="flex flex-wrap gap-2.5">
            {#each group.towers as name (name)}
              <li>
                <TowerCard
                  {name}
                  tier={group.label}
                  image={metaMap.get(name)?.image}
                  onclick={() => pick(name)}
                />
              </li>
            {/each}
          </ul>
        </section>
      {:else}
        <p class="px-4 py-8 text-center text-sm text-muted-foreground">
          No such towers found..!
        </p>
      {/each}
    </div>
  </div>
{/if}

<style>
  h3 {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  :global(.combobox-input) {
    height: 2rem;
    width: 15.625rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--muted);
    color: var(--foreground);
    padding: 0.25rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    outline: none;
    transition: border-color 0.15s;

    &::placeholder {
      color: var(--text-faint);
    }

    &:focus-visible {
      border-color: var(--border-strong);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    :global(.dark) & {
      background: oklch(0% 0 0 / 0.5);
    }
  }

  :global(.combobox-content) {
    z-index: 57;
    min-width: 15.625rem;
    overflow: hidden;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--popover);
    color: var(--foreground);

    &[data-state="open"] {
      animation: overlay-in 0.15s;
    }

    &[data-state="closed"] {
      animation: overlay-out 0.15s;
    }
  }

  :global(.combobox-item) {
    position: relative;
    display: flex;
    width: 100%;
    cursor: pointer;
    user-select: none;
    align-items: center;
    border-radius: var(--radius);
    padding: 0.375rem 2rem 0.375rem 1rem;
    font-size: 0.875rem;
    outline: none;

    &[data-disabled] {
      pointer-events: none;
      opacity: 0.5;
    }

    &[data-highlighted] {
      background: color-mix(in oklch, var(--primary) 22%, transparent);
      color: var(--foreground);
    }
  }
</style>
