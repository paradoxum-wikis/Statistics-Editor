<script lang="ts">
  import { Combobox } from "bits-ui";
  import { Check, ChevronsUpDown, X } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    buildCategoryMap,
    groupedTowerNames,
  } from "$lib/towerComponents/towers";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { profileStore } from "$lib/stores/profile.svelte";
  import { analytics } from "$lib/services/analytics";
  import TextInput from "./smol/TextInput.svelte";

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

  const categoryMap = $derived.by(() => {
    void towerStore.refreshTrigger;
    return buildCategoryMap(profileStore.current, {
      towerName: towerStore.selectedName,
      wikitext: towerStore.effectiveWikitext,
    });
  });

  const groups = $derived(
    groupedTowerNames(towerStore.names, query, categoryMap),
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
      <Combobox.Trigger class="absolute right-3 top-3">
        <ChevronsUpDown class="h-4 w-4 opacity-50" />
      </Combobox.Trigger>
    </div>

    <Combobox.Portal>
      <Combobox.Content class="combobox-content">
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
  <div class={["home-picker flex min-h-0 flex-1 flex-col gap-3", className]}>
    <TextInput
      type="search"
      placeholder="Enter a tower name!"
      bind:value={query}
      class="bg-card! border-border! rounded-[var(--radius)_0_0]!"
    />

    <div
      class="rounded-[0_0_var(--radius)] min-h-0 max-h-[min(60vh,36rem)] flex-1 overflow-y-auto border border-border bg-card md:max-h-none"
    >
      {#if !query && recent.length > 0}
        <section class="p-2">
          <h3 class="picker-section-title">Recent</h3>
          <ul class="picker-grid">
            {#each recent as name (name)}
              <li
                class="group relative min-w-0 rounded-[calc(var(--radius)-0.25rem)_0] hover:bg-accent hover:text-accent-foreground"
                out:slide={{ duration: 177, easing: cubicOut, axis: "x" }}
              >
                <button
                  type="button"
                  class="block w-full cursor-pointer truncate py-1.5 ps-4 pe-9 text-left text-sm outline-none"
                  onclick={() => pick(name)}
                >
                  {name}
                </button>
                <button
                  type="button"
                  class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-0.5 pe-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
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
          <h3 class="picker-section-title">{group.label}</h3>
          <ul class="picker-grid">
            {#each group.towers as name (name)}
              <li class="min-w-0">
                <button
                  class="combobox-item min-w-0 truncate hover:bg-accent hover:text-accent-foreground"
                  onclick={() => pick(name)}
                >
                  {name}
                </button>
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
  .picker-section-title {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .picker-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.125rem;
    /* remove when firefox adds support for gap decors */
    background: linear-gradient(var(--border), var(--border)) 50% / 1px 100%
      no-repeat;

    @media (min-width: 768px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      background:
        linear-gradient(var(--border), var(--border)) calc(100% / 3) / 1px 100%
          no-repeat,
        linear-gradient(var(--border), var(--border)) calc(200% / 3) / 1px 100%
          no-repeat;
    }

    @supports (row-rule: 7px solid) {
      background: none;
      column-rule: 1px solid var(--border);
    }
  }

  :global(.combobox-input) {
    height: 2.5rem;
    width: 15.625rem;
    border-radius: var(--radius) 0;
    border: 1px solid var(--input);
    background: var(--background);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    outline: none;

    &::placeholder {
      color: var(--muted-foreground);
    }

    &:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  :global(.combobox-content) {
    z-index: 47;
    min-width: 15.625rem;
    overflow: hidden;
    border-radius: var(--radius) 0;
    border: 1px solid var(--border);
    background: var(--popover);
    color: var(--popover-foreground);
    box-shadow:
      0 4px 6px -1px oklch(0 0 0 / 0.1),
      0 2px 4px -2px oklch(0 0 0 / 0.1);

    &[data-state="open"] {
      animation: overlay-in 150ms ease;
    }

    &[data-state="closed"] {
      animation: overlay-out 100ms ease;
    }
  }

  :global(.combobox-item) {
    position: relative;
    display: flex;
    width: 100%;
    cursor: pointer;
    user-select: none;
    align-items: center;
    border-radius: calc(var(--radius) - 0.25rem) 0;
    padding: 0.375rem 2rem 0.375rem 1rem;
    font-size: 0.875rem;
    outline: none;

    &[data-disabled] {
      pointer-events: none;
      opacity: 0.5;
    }

    &[data-highlighted] {
      background: var(--accent);
      color: var(--accent-foreground);
    }
  }
</style>
