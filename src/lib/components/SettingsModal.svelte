<script lang="ts">
  import { onMount } from "svelte";
  import { Dialog, Switch, Tabs } from "bits-ui";
  import {
    Bug,
    Diff,
    SquareDashedBottom,
    Scaling,
    Eraser,
    Skull,
    ChartLine,
  } from "@lucide/svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
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
      <div class="flex flex-col space-y-1.5 text-center sm:text-left">
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

        <Tabs.Content value="editor">
          <div class="grid gap-4 py-2">
            <div class={settingsItemClass}>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                >
                  <Eraser class="h-5 w-5 text-foreground" />
                </div>
                <div class="space-y-1">
                  <label
                    for="clear-on-edit"
                    class="text-sm font-medium leading-none"
                  >
                    Clear Cell on Edit
                  </label>
                  <p class="text-xs text-muted-foreground">
                    Clears the input box when you click on a cell instead of
                    keeping whatever was already there.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="clear-on-edit"
                checked={settingsStore.clearOnEdit}
                onCheckedChange={(v) => settingsStore.setClearOnEdit(v)}
                class={switchRootClass}
              >
                <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
              </Switch.Root>
            </div>

            <div class={settingsItemClass}>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                >
                  <Skull class="h-5 w-5 text-foreground" />
                </div>
                <div class="space-y-1">
                  <label for="rof-bug" class="text-sm font-medium leading-none"
                    >ROF Bug</label
                  >
                  <p class="text-xs text-muted-foreground">
                    Calculate statistics with the infamous Rate of Fire bug.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="rof-bug"
                checked={settingsStore.rofBug}
                onCheckedChange={(v) => settingsStore.setRofBug(v)}
                class={switchRootClass}
              >
                <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
              </Switch.Root>
            </div>

            <div class={settingsItemClass}>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                >
                  <Diff class="h-5 w-5 text-foreground" />
                </div>
                <div class="space-y-1">
                  <label
                    for="see-value-difference"
                    class="text-sm font-medium leading-none"
                  >
                    See Value Difference
                  </label>
                  <p class="text-xs text-muted-foreground">
                    Shows how much a value changed compared to the original.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="see-value-difference"
                checked={settingsStore.seeValueDifference}
                onCheckedChange={(v) => settingsStore.setSeeValueDifference(v)}
                class={switchRootClass}
              >
                <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
              </Switch.Root>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="appearance">
          <div class="grid gap-4 py-2">
            <div class={settingsItemClass}>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                >
                  <Scaling class="h-5 w-5 text-foreground" />
                </div>
                <div class="space-y-1">
                  <label
                    for="min-content-table-width"
                    class="text-sm font-medium leading-none"
                  >
                    Compact Table Width
                  </label>
                  <p class="text-xs text-muted-foreground">
                    Prevents the table from stretching to the full width,
                    keeping it only as wide as necessary.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="min-content-table-width"
                checked={settingsStore.minTableWidth}
                onCheckedChange={(v) => settingsStore.setMinTableWidth(v)}
                class={switchRootClass}
              >
                <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
              </Switch.Root>
            </div>

            <div class={settingsItemClass}>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                >
                  <SquareDashedBottom class="h-5 w-5 text-foreground" />
                </div>
                <div class="space-y-1">
                  <label
                    for="hide-cell-wrapper"
                    class="text-sm font-medium leading-none"
                  >
                    Hide Cell Wrapper
                  </label>
                  <p class="text-xs text-muted-foreground">
                    Hides the visual wrapper inside table cells, letting the
                    number sit directly in the cell.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="hide-cell-wrapper"
                checked={settingsStore.hideCellWrapper}
                onCheckedChange={(v) => settingsStore.setHideCellWrapper(v)}
                class={switchRootClass}
              >
                <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
              </Switch.Root>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="advanced">
          <div class="grid gap-4 py-2">
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
                    class="text-sm font-medium leading-none">Analytics</label
                  >
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

            <div class={settingsItemClass}>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                >
                  <Bug class="h-5 w-5 text-foreground" />
                </div>
                <div class="space-y-1">
                  <label
                    for="debug-mode"
                    class="text-sm font-medium leading-none"
                  >
                    Debug Mode
                  </label>
                  <p class="text-xs text-muted-foreground">
                    Enables detailed logging in the console.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="debug-mode"
                checked={settingsStore.debugMode}
                onCheckedChange={(v) => settingsStore.setDebug(v)}
                class={switchRootClass}
              >
                <Switch.Thumb class={switchThumbClass}></Switch.Thumb>
              </Switch.Root>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <div class="flex items-center justify-end">
        <Dialog.Close class="btn btn-secondary text-sm px-4 py-2">
          Close
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
