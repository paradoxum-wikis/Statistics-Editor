<script lang="ts">
  import { Tooltip, Popover } from "bits-ui";
  import IconBtn from "./smol/IconBtn.svelte";
  import Veperator from "./smol/Veperator.svelte";
  import GlobalModifierPanel from "./smol/GlobalModifierPanel.svelte";
  import { settingsStore, BOOLEAN_SETTINGS } from "$lib/stores/settings.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { isGlobalModifierActive } from "$lib/utils/globalModifier";
  import {
    House,
    Settings,
    Sun,
    Moon,
    SunMoon,
    Check,
    Zap,
  } from "@lucide/svelte";

  let {
    settingsOpen = $bindable(false),
    onHome,
  }: {
    settingsOpen?: boolean;
    onHome?: () => void | Promise<void>;
  } = $props();

  let themeOpen = $state(false);
  let modifierOpen = $state(false);

  const activeSettings = $derived(
    BOOLEAN_SETTINGS.filter((setting) => settingsStore.getBoolean(setting.key)),
  );

  const modifierActive = $derived(
    isGlobalModifierActive(towerStore.globalModifier),
  );
</script>

<div
  class="flex h-8 shrink-0 items-center gap-0.5 border-t border-border bg-card px-2"
>
  <div class="flex items-center gap-0.5">
    <IconBtn class="status-bar-btn" onclick={() => onHome?.()} title="Home">
      <House size={16} />
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

    <Popover.Root bind:open={modifierOpen}>
      <Popover.Trigger>
        {#snippet child({ props })}
          <IconBtn
            {...props}
            class="status-bar-btn {modifierActive
              ? 'text-amber-600 dark:text-amber-400'
              : ''}"
            title="Global Modifier"
          >
            <Zap size={16} />
          </IconBtn>
        {/snippet}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="popover-content w-[min(36rem,calc(100vw-2rem))]!"
          side="top"
          align="start"
          sideOffset={6}
        >
          <GlobalModifierPanel />
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
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <IconBtn {...props} class="status-bar-indicator">
                    <setting.icon size={14} />
                  </IconBtn>
                {/snippet}
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
</div>
