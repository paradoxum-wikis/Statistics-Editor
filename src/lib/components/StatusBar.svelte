<script lang="ts">
  import { Popover } from "bits-ui";
  import IconBtn from "./smol/IconBtn.svelte";
  import Tip from "./smol/Tip.svelte";
  import Veperator from "./smol/Veperator.svelte";
  import GlobalModifier from "./tool/GlobalModifier.svelte";
  import StatsChart from "./tool/StatsChart.svelte";
  import CreateTower from "./tool/CreateTower.svelte";
  import { settingsStore, BOOLEAN_SETTINGS } from "$lib/stores/settings.svelte";
  import { announcementsStore } from "$lib/stores/announcements.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import {
    House,
    Settings,
    Sun,
    Moon,
    SunMoon,
    Check,
    Pin,
    Megaphone,
  } from "@lucide/svelte";

  let {
    settingsOpen = $bindable(false),
    onHome,
    onTowerCreated,
  }: {
    settingsOpen?: boolean;
    onHome?: () => void | Promise<void>;
    onTowerCreated?: (name: string) => void | Promise<void>;
  } = $props();

  let themeOpen = $state(false);
  let pinsOpen = $state(false);

  const pinnedSettings = $derived(settingsStore.pinnedSettings);
</script>

<div
  class="flex h-8 shrink-0 items-center gap-0.5 border-t border-border bg-card px-2"
>
  <div class="flex items-center gap-0.5">
    <IconBtn class="status-bar-btn" onclick={() => onHome?.()} title="Home">
      <House size={16} />
    </IconBtn>

    <IconBtn
      class="status-bar-btn"
      onclick={() => announcementsStore.openList()}
      title="Announcements"
    >
      <Megaphone size={16} />
    </IconBtn>

    <Popover.Root bind:open={themeOpen}>
      <Popover.Trigger>
        {#snippet child({ props })}
          <IconBtn {...props} class="status-bar-btn" title="Theme">
            {#if settingsStore.theme === "light"}
              <Sun size={16} />
            {:else if settingsStore.theme === "dark"}
              <Moon size={16} />
            {:else}
              <SunMoon size={16} />
            {/if}
          </IconBtn>
        {/snippet}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="dropdown-content w-auto! min-w-42"
          side="top"
          align="start"
          sideOffset={6}
        >
          <h4 class="mb-1 px-2 pt-1 text-sm font-medium">Theme</h4>
          <div class="grid gap-0.5">
            <button
              class="dropdown-item w-full justify-start!"
              onclick={() => {
                settingsStore.setTheme("light");
                themeOpen = false;
              }}
            >
              <Sun class="me-2 h-4 w-4" />
              <span>Light</span>
              {#if settingsStore.theme === "light"}
                <Check class="ms-auto h-4 w-4" />
              {/if}
            </button>
            <button
              class="dropdown-item w-full justify-start!"
              onclick={() => {
                settingsStore.setTheme("dark");
                themeOpen = false;
              }}
            >
              <Moon class="me-2 h-4 w-4" />
              <span>Dark</span>
              {#if settingsStore.theme === "dark"}
                <Check class="ms-auto h-4 w-4" />
              {/if}
            </button>
            <button
              class="dropdown-item w-full justify-start!"
              onclick={() => {
                settingsStore.setTheme("system");
                themeOpen = false;
              }}
            >
              <SunMoon class="me-2 h-4 w-4" />
              <span>System</span>
              {#if settingsStore.theme === "system"}
                <Check class="ms-auto h-4 w-4" />
              {/if}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <IconBtn
      class="status-bar-btn"
      onclick={() => (settingsOpen = true)}
      title="Settings"
    >
      <Settings size={16} />
    </IconBtn>

    <Veperator />

    <GlobalModifier variant="icon" />
    <StatsChart variant="icon" />
    <CreateTower onCreated={onTowerCreated} />
  </div>

  <div class="ms-auto flex min-w-0 items-center gap-1 px-1">
    {#if pinnedSettings.length > 0}
      <div class="flex items-center gap-0.5">
        {#each pinnedSettings as setting (setting.key)}
          {@const enabled = settingsStore.getBoolean(setting.key)}
          {@const parent = settingsStore.parentOf(setting)}
          {@const parentOk = !parent || settingsStore.getBoolean(parent.key)}
          <Tip>
            {#snippet content()}
              <p class="text-sm font-medium">{setting.label}</p>
              <p class="text-xs text-muted-foreground">
                {setting.description}
              </p>
              {#if !parentOk && parent}
                <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Requires {parent.label}
                </p>
              {/if}
            {/snippet}
            {#snippet children({ props })}
              <button
                {...props}
                type="button"
                class="status-bar-indicator"
                aria-label={setting.label}
                aria-pressed={enabled && parentOk}
                disabled={!parentOk}
                onclick={() => settingsStore.setBoolean(setting.key, !enabled)}
              >
                <setting.icon size={14} />
              </button>
            {/snippet}
          </Tip>
        {/each}
      </div>
    {/if}

    <Popover.Root bind:open={pinsOpen}>
      <Popover.Trigger>
        {#snippet child({ props })}
          <IconBtn
            {...props}
            class="status-bar-btn"
            title="Pin settings to status bar"
          >
            <Pin size={14} />
          </IconBtn>
        {/snippet}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="dropdown-content w-auto! min-w-56 max-w-72"
          side="top"
          align="end"
          sideOffset={6}
        >
          <h4 class="mb-1 px-2 pt-1 text-sm font-medium">Pinner</h4>
          <p class="mb-1.5 px-2 text-xs text-muted-foreground">
            In the case you REALLY need to toggle.
          </p>
          <div class="pin-list">
            {#each BOOLEAN_SETTINGS as setting (setting.key)}
              {@const pinned = settingsStore.isPinned(setting.key)}
              <button
                type="button"
                class="pin-item"
                aria-pressed={pinned}
                onclick={() => settingsStore.togglePin(setting.key)}
              >
                <setting.icon size={16} />
                <span class="mx-1">{setting.label}</span>
                <span aria-hidden="true">
                  {#if pinned}
                    <Pin size={14} />
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    {#if towerStore.sharePreviewId}
      <Veperator />
      <span
        class="shrink-0 px-1 text-xs font-semibold text-sky-600 dark:text-sky-400"
      >
        Sandboxed
      </span>
    {:else if towerStore.isDirty}
      <Veperator />
      <span
        class="shrink-0 px-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
      >
        Unsaved
      </span>
    {/if}
  </div>
</div>

<style>
  :global(.status-bar-btn) {
    border-radius: var(--radius);
    background: var(--muted);
    padding: 0.25rem;
    color: var(--muted-foreground);

    &:hover,
    &[data-state="open"] {
      background: var(--secondary);
      color: var(--foreground);
    }
  }

  .status-bar-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    padding: 0.25rem;
    color: var(--muted-foreground);
    cursor: pointer;
    transition:
      color 0.1s,
      background 0.1s;

    &:hover:not(:disabled) {
      background: var(--secondary);
      color: var(--foreground);
    }

    &[aria-pressed="true"] {
      color: var(--primary);

      &:hover,
      &[data-state="open"] {
        color: var(--primary);
      }
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 1px;
    }
  }
</style>
