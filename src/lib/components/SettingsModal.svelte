<script lang="ts">
  import { Dialog, Tabs } from "bits-ui";
  import Switch from "$lib/components/smol/Switch.svelte";
  import {
    settingsStore,
    settingGroupsForTab,
    type BooleanSetting,
    type SettingTab,
  } from "$lib/stores/settings.svelte";

  const SETTING_TABS: SettingTab[] = ["editor", "appearance", "advanced"];

  let { open = $bindable(false) } = $props();
</script>

{#snippet settingRow(
  setting: BooleanSetting,
  child = false,
  parentActive?: boolean,
)}
  <div
    class="relative z-7 flex items-center justify-between gap-2 rounded-[var(--radius)_0] border border-border bg-card p-4"
    class:setting-row-collapsed={child && parentActive === false}
    class:setting-row-revealed={child && parentActive === true}
  >
    <div class="flex items-center gap-3">
      <div
        class="flex shrink-0 items-center justify-center rounded-full border border-border bg-background {child
          ? 'h-7 w-7'
          : 'h-9 w-9'}"
      >
        <setting.icon class="text-foreground {child ? 'h-4 w-4' : 'h-5 w-5'}" />
      </div>
      <div class="space-y-1">
        <label
          for={setting.id}
          class="font-medium leading-none {child ? 'text-xs' : 'text-sm'}"
        >
          {setting.label}
        </label>
        <p class="text-muted-foreground {child ? 'text-[0.65rem]' : 'text-xs'}">
          {setting.description}
        </p>
      </div>
    </div>
    <Switch
      id={setting.id}
      checked={settingsStore.getBoolean(setting.key)}
      disabled={child && parentActive === false}
      onCheckedChange={(v: boolean) => settingsStore.setBoolean(setting.key, v)}
    />
  </div>
{/snippet}

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay"></Dialog.Overlay>
    <Dialog.Content class="dialog-content sm:max-w-2xl">
      <div class="flex flex-col space-y-1.5 text-center sm:text-start">
        <Dialog.Title class="dialog-title">
          <h2>Settings</h2>
        </Dialog.Title>
        <Dialog.Description class="dialog-description">
          Please change them to your heart's content.
        </Dialog.Description>
      </div>

      <Tabs.Root value="editor">
        <Tabs.List
          class="mb-4 flex w-full rounded-[var(--radius)_0] border border-border bg-muted p-1"
        >
          <Tabs.Trigger
            value="editor"
            class="flex-1 rounded-[calc(var(--radius)-0.25rem)_0] px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >Editor</Tabs.Trigger
          >
          <Tabs.Trigger
            value="appearance"
            class="flex-1 rounded-[calc(var(--radius)-0.25rem)_0] px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >Appearance</Tabs.Trigger
          >
          <Tabs.Trigger
            value="advanced"
            class="flex-1 rounded-[calc(var(--radius)-0.25rem)_0] px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >Advanced</Tabs.Trigger
          >
        </Tabs.List>

        {#each SETTING_TABS as tab (tab)}
          <Tabs.Content value={tab}>
            <div class="grid gap-4 py-2">
              {#each settingGroupsForTab(tab) as group (group.parent.key)}
                <div class="relative flex flex-col">
                  {@render settingRow(group.parent)}

                  {#each group.children as child (child.key)}
                    {@const parentEnabled = settingsStore.getBoolean(
                      group.parent.key,
                    )}
                    <div
                      class="setting-child-wrap"
                      class:setting-child-wrap-revealed={parentEnabled}
                    >
                      {@render settingRow(child, true, parentEnabled)}
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          </Tabs.Content>
        {/each}
      </Tabs.Root>

      <div class="flex items-center justify-end">
        <Dialog.Close class="btn btn-secondary btn-sm">Close</Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .setting-child-wrap {
    position: relative;
    margin-top: -2.75rem;
    margin-bottom: -0.45rem;
    overflow: hidden;
    pointer-events: none;
    opacity: 0.72;
    transition:
      margin-top 0.27s,
      margin-bottom 0.27s,
      opacity 0.27s;
  }

  .setting-child-wrap-revealed {
    margin-top: 0.35rem;
    margin-bottom: 0;
    pointer-events: auto;
    opacity: 1;
  }

  .setting-row-collapsed {
    padding: 0.45rem 0.85rem 0.45rem 1.15rem;
    background: color-mix(in oklch, var(--secondary) 6%, transparent);
    transform: translateY(-0.35rem) scale(0.95);
    transition:
      transform 0.27s,
      padding 0.27s,
      background 0.27s;
  }

  .setting-row-revealed {
    padding: 0.5rem 1rem 0.5rem 1.25rem;
    background: color-mix(in oklch, var(--secondary) 10%, transparent);
    transform: translateY(0) scale(1);
    transition:
      transform 0.27s,
      padding 0.27s,
      background 0.27s;
  }
</style>
