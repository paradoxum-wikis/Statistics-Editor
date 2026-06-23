<script lang="ts">
  import { Menubar, Tooltip, Popover, Switch, Label } from "bits-ui";
  import IconBtn from "./smol/IconBtn.svelte";
  import Veperator from "./smol/Veperator.svelte";
  import Btn from "./smol/Btn.svelte";
  import TextInput from "./smol/TextInput.svelte";
  import { settingsStore, BOOLEAN_SETTINGS } from "$lib/stores/settings.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { parseNumeric } from "$lib/utils/format";
  import {
    House,
    Settings,
    Sun,
    Moon,
    SunMoon,
    Check,
    Zap,
    X,
  } from "@lucide/svelte";

  let {
    settingsOpen = $bindable(false),
    onHome,
  }: {
    settingsOpen?: boolean;
    onHome?: () => void | Promise<void>;
  } = $props();

  let modifierOpen = $state(false);
  let modifierColumn = $state("");

  const activeSettings = $derived(
    BOOLEAN_SETTINGS.filter((setting) => settingsStore.getBoolean(setting.key)),
  );

  const modifierActive = $derived(
    towerStore.globalModifier.entries.some(
      (entry) => entry.enabled && (entry.delta !== 0 || entry.percent !== 0),
    ),
  );

  const switchRootClass =
    "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-200";
  const switchThumbClass =
    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0";
  const modifierFieldClass = "flex min-w-0 flex-1 items-center gap-0.5";
  const modifierSuffixClass =
    "w-3 shrink-0 text-center text-[0.6875rem] text-muted-foreground";
  const modifierInputClass = "h-[1.625rem]! min-w-0 flex-1 px-2 py-0.5 text-xs";

  const canAddColumn = $derived(modifierColumn.trim().length > 0);

  function handleColumnKeydown(e: KeyboardEvent) {
    if (e.key !== "Enter" || !canAddColumn) return;
    e.preventDefault();
    e.stopPropagation();
    addModifierColumn();
  }

  function addModifierColumn() {
    const column = modifierColumn.trim();
    if (!column) return;

    const key = column.toLowerCase();
    if (
      towerStore.globalModifier.entries.some(
        (entry) => entry.column.toLowerCase() === key,
      )
    ) {
      modifierColumn = "";
      return;
    }

    towerStore.globalModifier.entries = [
      ...towerStore.globalModifier.entries,
      { column, delta: 0, percent: 0, enabled: true },
    ];
    modifierColumn = "";
  }

  function removeModifierEntry(index: number) {
    towerStore.globalModifier.entries =
      towerStore.globalModifier.entries.filter((_, i) => i !== index);
  }

  function setEntryEnabled(index: number, enabled: boolean) {
    const entries = [...towerStore.globalModifier.entries];
    entries[index] = { ...entries[index], enabled };
    towerStore.globalModifier.entries = entries;
  }

  function setEntryDelta(index: number, raw: string) {
    const delta = parseNumeric(raw);
    const entries = [...towerStore.globalModifier.entries];
    entries[index] = {
      ...entries[index],
      delta: Number.isFinite(delta) ? delta : 0,
    };
    towerStore.globalModifier.entries = entries;
  }

  function setEntryPercent(index: number, raw: string) {
    const percent = parseNumeric(raw);
    const entries = [...towerStore.globalModifier.entries];
    entries[index] = {
      ...entries[index],
      percent: Number.isFinite(percent) ? percent : 0,
    };
    towerStore.globalModifier.entries = entries;
  }

  function entryNumericValue(value: number): string {
    return value === 0 ? "" : String(value);
  }
</script>

<Menubar.Root
  class="flex h-8 shrink-0 items-center gap-0.5 border-t border-border bg-card px-2"
>
  <div class="flex items-center gap-0.5">
    <IconBtn class="status-bar-btn" onclick={() => onHome?.()} title="Home">
      <House size={16} />
    </IconBtn>

    <Menubar.Menu>
      <Menubar.Trigger class="status-bar-btn" title="Theme">
        {#if settingsStore.theme === "light"}
          <Sun size={16} />
        {:else if settingsStore.theme === "dark"}
          <Moon size={16} />
        {:else}
          <SunMoon size={16} />
        {/if}
      </Menubar.Trigger>
      <Menubar.Portal>
        <Menubar.Content
          class="dropdown-content w-auto! min-w-42"
          side="top"
          align="start"
          sideOffset={6}
        >
          <h4 class="mb-1 px-2 text-sm font-medium">Theme</h4>
          <Menubar.RadioGroup
            value={settingsStore.theme}
            onValueChange={(value) => {
              if (value === "light" || value === "dark" || value === "system") {
                settingsStore.setTheme(value);
              }
            }}
          >
            <Menubar.RadioItem
              value="light"
              class="dropdown-item w-full justify-start!"
            >
              {#snippet children({ checked })}
                <Sun class="me-2 h-4 w-4" />
                <span>Light</span>
                {#if checked}
                  <Check class="ms-auto h-4 w-4" />
                {/if}
              {/snippet}
            </Menubar.RadioItem>
            <Menubar.RadioItem
              value="dark"
              class="dropdown-item w-full justify-start!"
            >
              {#snippet children({ checked })}
                <Moon class="me-2 h-4 w-4" />
                <span>Dark</span>
                {#if checked}
                  <Check class="ms-auto h-4 w-4" />
                {/if}
              {/snippet}
            </Menubar.RadioItem>
            <Menubar.RadioItem
              value="system"
              class="dropdown-item w-full justify-start!"
            >
              {#snippet children({ checked })}
                <SunMoon class="me-2 h-4 w-4" />
                <span>System</span>
                {#if checked}
                  <Check class="ms-auto h-4 w-4" />
                {/if}
              {/snippet}
            </Menubar.RadioItem>
          </Menubar.RadioGroup>
        </Menubar.Content>
      </Menubar.Portal>
    </Menubar.Menu>

    <IconBtn
      class="status-bar-btn"
      onclick={() => (settingsOpen = true)}
      title="Settings"
    >
      <Settings size={16} />
    </IconBtn>

    <Veperator />

    <Popover.Root bind:open={modifierOpen}>
      <Popover.Trigger
        class="icon-btn status-bar-btn {modifierActive
          ? 'text-amber-600 dark:text-amber-400'
          : ''}"
        title="Global Modifier"
      >
        <Zap size={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="popover-content w-[min(36rem,calc(100vw-2rem))]!"
          side="top"
          align="start"
          sideOffset={6}
        >
          <div class="space-y-3">
            <div class="space-y-1">
              <h4 class="text-sm font-medium leading-none">Global Modifier</h4>
              <p class="text-xs text-muted-foreground">
                This does not change saved data.
              </p>
            </div>

            <div class="space-y-1.5">
              <Label.Root for="modifier-column" class="text-xs font-medium">
                Add column
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

            {#if towerStore.globalModifier.entries.length > 0}
              <div class="grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto">
                {#each towerStore.globalModifier.entries as entry, index (entry.column)}
                  <div
                    class="rounded-[calc(var(--radius)-0.625rem)_0] border border-border bg-secondary/40 p-1.5"
                  >
                    <div class="mb-1 flex items-center justify-between gap-1">
                      <span class="min-w-0 truncate text-xs font-medium"
                        >{entry.column}</span
                      >
                      <div class="flex items-center gap-1">
                        <Switch.Root
                          checked={entry.enabled}
                          onCheckedChange={(enabled) =>
                            setEntryEnabled(index, enabled)}
                          class={switchRootClass}
                          aria-label="Enable {entry.column} modifier"
                        >
                          <Switch.Thumb class={switchThumbClass} />
                        </Switch.Root>
                        <button
                          type="button"
                          class="inline-flex items-center justify-center rounded-[calc(var(--radius)-0.875rem)_0] p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Remove"
                          onclick={() => removeModifierEntry(index)}
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
                            setEntryDelta(
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
                            setEntryPercent(
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>

  <div class="ms-auto flex min-w-0 items-center gap-2 px-2">
    {#if activeSettings.length > 0}
      <Tooltip.Provider delayDuration={200}>
        <div class="flex items-center gap-1">
          {#each activeSettings as setting (setting.key)}
            <Tooltip.Root>
              <Tooltip.Trigger class="icon-btn status-bar-indicator">
                <setting.icon size={14} />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  class="tooltip-content"
                  side="top"
                  sideOffset={6}
                >
                  <p class="text-sm font-medium">{setting.label}</p>
                  <p class="text-xs text-muted-foreground">
                    {setting.description}
                  </p>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          {/each}
        </div>
      </Tooltip.Provider>
    {/if}

    {#if towerStore.isDirty}
      <Veperator />
      <span class="shrink-0 text-xs text-amber-600 dark:text-amber-400">
        Unsaved
      </span>
    {/if}
  </div>
</Menubar.Root>
