<script lang="ts">
  import { Label } from "bits-ui";
  import Btn from "../smol/Btn.svelte";
  import Switch from "../smol/Switch.svelte";
  import TextInput from "../smol/TextInput.svelte";
  import { modifierStore } from "$lib/stores/modifier.svelte";
  import { X } from "@lucide/svelte";

  let modifierColumn = $state("");

  const canAddColumn = $derived(modifierColumn.trim().length > 0);

  const modifierFieldClass = "flex min-w-0 flex-1 items-center gap-0.5";
  const modifierSuffixClass =
    "w-3 shrink-0 text-center text-[0.6875rem] text-muted-foreground";
  const modifierInputClass = "h-[1.625rem]! min-w-0 flex-1 px-2 py-0.5 text-xs";

  function handleColumnKeydown(e: KeyboardEvent) {
    if (e.key !== "Enter" || !canAddColumn) return;
    e.preventDefault();
    e.stopPropagation();
    addModifierColumn();
  }

  function addModifierColumn() {
    modifierStore.addColumn(modifierColumn);
    modifierColumn = "";
  }

  function entryNumericValue(value: number): string {
    return value === 0 ? "" : String(value);
  }
</script>

<div class="space-y-3">
  <div class="space-y-1">
    <h4 class="text-sm font-medium leading-none">Global Modifier</h4>
    <p class="text-xs text-muted-foreground">
      This does not change saved data.
    </p>
  </div>

  <div class="space-y-1.5">
    <Label.Root for="modifier-column" class="text-xs font-medium">
      Add Column
    </Label.Root>
    <div class="flex gap-2">
      <TextInput
        id="modifier-column"
        class="min-w-0 flex-1"
        bind:value={modifierColumn}
        placeholder="e.g. Damage"
        onkeydown={handleColumnKeydown}
      />
      <Btn
        size="sm"
        variant={canAddColumn ? "primary" : "secondary"}
        onclick={addModifierColumn}
        disabled={!canAddColumn}
      >
        Add
      </Btn>
    </div>
  </div>

  {#if modifierStore.entries.length > 0}
    <div
      class="grid max-h-60 grid-cols-1 gap-1.5 overflow-y-auto min-[24rem]:grid-cols-2"
    >
      {#each modifierStore.entries as entry, index (entry.column)}
        <div
          class="rounded-[calc(var(--radius)-0.625rem)_0] border border-border bg-secondary/40 p-1.5"
        >
          <div class="mb-1 flex items-center justify-between gap-1">
            <span class="min-w-0 truncate text-xs font-medium"
              >{entry.column}</span
            >
            <div class="flex items-center gap-1">
              <Switch
                size="sm"
                checked={entry.enabled}
                onCheckedChange={(enabled: boolean) =>
                  modifierStore.setEnabled(index, enabled)}
                aria-label="Enable {entry.column} modifier"
              />
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-[calc(var(--radius)-0.875rem)_0] p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Remove"
                onclick={() => modifierStore.removeEntry(index)}
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div class="flex gap-1">
            <div class={modifierFieldClass}>
              <span class={modifierSuffixClass}>+</span>
              <TextInput
                inputmode="decimal"
                class={modifierInputClass}
                value={entryNumericValue(entry.delta)}
                oninput={(e: Event) =>
                  modifierStore.setDelta(
                    index,
                    (e.currentTarget as HTMLInputElement).value,
                  )}
                placeholder="0"
                aria-label="{entry.column} flat change"
              />
            </div>
            <div class={modifierFieldClass}>
              <TextInput
                inputmode="decimal"
                class={modifierInputClass}
                value={entryNumericValue(entry.percent)}
                oninput={(e: Event) =>
                  modifierStore.setPercent(
                    index,
                    (e.currentTarget as HTMLInputElement).value,
                  )}
                placeholder="0"
                aria-label="{entry.column} percent change"
              />
              <span class={modifierSuffixClass}>%</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
