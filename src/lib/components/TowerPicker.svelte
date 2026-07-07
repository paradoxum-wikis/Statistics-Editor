<script lang="ts">
  import { Combobox } from "bits-ui";
  import { Check, ChevronsUpDown } from "@lucide/svelte";
  import { groupedTowerNames } from "$lib/towerComponents/towers";
  import { towerStore } from "$lib/stores/tower.svelte";
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

  const groups = $derived(groupedTowerNames(towerStore.names, query));

  const recent = $derived(
    towerStore.recentNames.filter((name) => towerStore.names.includes(name)),
  );

  function pick(name: string) {
    if (!name || name === selected) return;
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
    <div class="home-picker-search">
      <TextInput
        type="search"
        placeholder="Search towers..."
        bind:value={query}
      />
    </div>

    <div
      class="home-picker-list min-h-0 max-h-[min(60vh,36rem)] flex-1 overflow-y-auto border border-border bg-card md:max-h-none"
    >
      {#if !query && recent.length > 0}
        <section class="p-2">
          <h3 class="picker-section-title">Recent</h3>
          <ul>
            {#each recent as name (name)}
              <li>
                <button
                  class="combobox-item hover:bg-accent hover:text-accent-foreground"
                  onclick={() => pick(name)}
                >
                  {name}
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#each groups as group (group.label)}
        <section class="p-2">
          <h3 class="picker-section-title">{group.label}</h3>
          <ul>
            {#each group.towers as name (name)}
              <li>
                <button
                  class="combobox-item hover:bg-accent hover:text-accent-foreground"
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
          No towers found
        </p>
      {/each}
    </div>
  </div>
{/if}

<style>
  .home-picker-search :global(.input) {
    border-radius: var(--radius) 0 0;
  }

  .home-picker-list {
    border-radius: 0 0 var(--radius);
  }

  .picker-section-title {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }
</style>
