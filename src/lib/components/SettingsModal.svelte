<script lang="ts">
  import { onMount } from "svelte";
  import { Dialog, Switch, Tabs } from "bits-ui";
  import { ChartLine } from "@lucide/svelte";
  import {
    settingsStore,
    settingsForTab,
    type SettingTab,
  } from "$lib/stores/settings.svelte";

  const SETTING_TABS: SettingTab[] = ["editor", "appearance", "advanced"];
  import { analytics } from "$lib/services/analytics";

  let { open = $bindable(false) } = $props();

  let analyticsEnabled = $state(false);

  const settingsTabsListClass =
    "mb-4 flex w-full [border-radius:var(--radius)_0] border border-border bg-muted p-1";
  const settingsTabTriggerClass =
    "flex-1 [border-radius:calc(var(--radius)-0.25rem)_0] px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm";
  const settingsItemClass =
    "flex items-center justify-between space-x-2 [border-radius:var(--radius)_0] border border-border bg-secondary/10 p-4";
  const switchRootClass =
    "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-200";
  const switchThumbClass =
    "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0";

  onMount(() => {
    analyticsEnabled = localStorage.getItem("analyticsConsent") === "true";
    const handler = (e: any) => {
      analyticsEnabled = e.detail.granted;
    };
    document.addEventListener("analyticsConsentChanged", handler);
    return () =>
      document.removeEventListener("analyticsConsentChanged", handler);
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="settings-overlay"></Dialog.Overlay>
    <Dialog.Content class="settings-content sm:max-w-2xl">
      <div class="flex flex-col space-y-1.5 text-center sm:text-start">
        <Dialog.Title
          class="text-lg font-semibold leading-none tracking-tight text-foreground"
        >
          Settings
        </Dialog.Title>
        <Dialog.Description class="text-sm text-muted-foreground">
          Please change them to your heart's content.
        </Dialog.Description>
      </div>

      <Tabs.Root value="editor">
        <Tabs.List class={settingsTabsListClass}>
          <Tabs.Trigger value="editor" class={settingsTabTriggerClass}
            >Editor</Tabs.Trigger
          >
          <Tabs.Trigger value="appearance" class={settingsTabTriggerClass}
            >Appearance</Tabs.Trigger
          >
          <Tabs.Trigger value="advanced" class={settingsTabTriggerClass}
            >Advanced</Tabs.Trigger
          >
        </Tabs.List>

        {#each SETTING_TABS as tab (tab)}
          <Tabs.Content value={tab}>
            <div class="grid gap-4 py-2">
              {#each settingsForTab(tab) as setting (setting.key)}
                <div class={settingsItemClass}>
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                    >
                      <setting.icon class="h-5 w-5 text-foreground" />
                    </div>
                    <div class="space-y-1">
                      <label
                        for={setting.id}
                        class="text-sm font-medium leading-none"
                      >
                        {setting.label}
                      </label>
                      <p class="text-xs text-muted-foreground">
                        {setting.description}
                      </p>
                    </div>
                  </div>
                  <Switch.Root
                    id={setting.id}
                    checked={settingsStore.getBoolean(setting.key)}
                    onCheckedChange={(v) =>
                      settingsStore.setBoolean(setting.key, v)}
                    class={switchRootClass}
                  >
                    <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
                  </Switch.Root>
                </div>
              {/each}

              {#if tab === "advanced"}
                <div class={settingsItemClass}>
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                    >
                      <ChartLine class="h-5 w-5 text-foreground" />
                    </div>
                    <div class="space-y-1">
                      <label
                        for="analytics-toggle"
                        class="text-sm font-medium leading-none"
                      >
                        Analytics
                      </label>
                      <p class="text-xs text-muted-foreground">
                        Help us improve by sharing anonymous usage data.
                      </p>
                    </div>
                  </div>
                  <Switch.Root
                    id="analytics-toggle"
                    checked={analyticsEnabled}
                    onCheckedChange={(v) => analytics.setConsent(v)}
                    class={switchRootClass}
                  >
                    <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
                  </Switch.Root>
                </div>
              {/if}
            </div>
          </Tabs.Content>
        {/each}
      </Tabs.Root>

      <div class="flex items-center justify-end">
        <Dialog.Close class="btn btn-secondary text-sm px-4 py-2">
          Close
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
