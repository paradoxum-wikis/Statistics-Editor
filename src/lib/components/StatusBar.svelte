<script lang="ts">
  import { Popover } from "bits-ui";
  import IconBtn from "./smol/IconBtn.svelte";
  import Tip from "./smol/Tip.svelte";
  import Veperator from "./smol/Veperator.svelte";
  import GlobalModifier from "./tool/GlobalModifier.svelte";
  import CreateTower from "./tool/CreateTower.svelte";
  import { settingsStore, BOOLEAN_SETTINGS } from "$lib/stores/settings.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { House, Settings, Sun, Moon, SunMoon, Check } from "@lucide/svelte";

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

  const activeSettings = $derived(
    BOOLEAN_SETTINGS.filter((setting) => settingsStore.getBoolean(setting.key)),
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

    <GlobalModifier variant="icon" />
    <CreateTower onCreated={onTowerCreated} />
  </div>

  <div class="ms-auto flex min-w-0 items-center gap-2 px-2">
    {#if activeSettings.length > 0}
      <div class="flex items-center gap-1">
        {#each activeSettings as setting (setting.key)}
          <Tip>
            {#snippet content()}
              <p class="text-sm font-medium">{setting.label}</p>
              <p class="text-xs text-muted-foreground">
                {setting.description}
              </p>
            {/snippet}
            {#snippet children({ props })}
              <IconBtn {...props} class="status-bar-indicator">
                <setting.icon size={14} />
              </IconBtn>
            {/snippet}
          </Tip>
        {/each}
      </div>
    {/if}

    {#if towerStore.sharePreviewId}
      <Veperator />
      <span class="shrink-0 text-xs text-sky-600 dark:text-sky-400">
        Sandboxed
      </span>
    {:else if towerStore.isDirty}
      <Veperator />
      <span class="shrink-0 text-xs text-amber-600 dark:text-amber-400">
        Unsaved
      </span>
    {/if}
  </div>
</div>
