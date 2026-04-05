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
      <div class="settings-header">
        <Dialog.Title class="settings-title">Settings</Dialog.Title>
        <Dialog.Description class="settings-description">
          Manage your application preferences.
        </Dialog.Description>
      </div>

      <Tabs.Root value="appearance" class="mt-4">
        <Tabs.List class="settings-tabs-list">
          <Tabs.Trigger value="editor" class="settings-tab-trigger"
            >Editor</Tabs.Trigger
          >
          <Tabs.Trigger value="appearance" class="settings-tab-trigger"
            >Appearance</Tabs.Trigger
          >
          <Tabs.Trigger value="advanced" class="settings-tab-trigger"
            >Advanced</Tabs.Trigger
          >
        </Tabs.List>

        <Tabs.Content value="editor">
          <div class="settings-grid">
            <div class="settings-item">
              <div class="flex items-center gap-3">
                <div class="settings-icon-wrapper">
                  <Eraser class="h-5 w-5 text-foreground" />
                </div>
                <div class="settings-label-group">
                  <label for="clear-on-edit" class="settings-label">
                    Clear Cell on Edit
                  </label>
                  <p class="settings-help-text">
                    Clears the input box when you click on a cell instead of
                    keeping whatever was already there.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="clear-on-edit"
                checked={settingsStore.clearOnEdit}
                onCheckedChange={(v) => settingsStore.setClearOnEdit(v)}
                class="switch-root"
              >
                <Switch.Thumb class="switch-thumb"></Switch.Thumb>
              </Switch.Root>
            </div>

            <div class="settings-item">
              <div class="flex items-center gap-3">
                <div class="settings-icon-wrapper">
                  <Skull class="h-5 w-5 text-foreground" />
                </div>
                <div class="settings-label-group">
                  <label for="rof-bug" class="settings-label">ROF Bug</label>
                  <p class="settings-help-text">
                    Calculate statistics with the infamous Rate of Fire bug.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="rof-bug"
                checked={settingsStore.rofBug}
                onCheckedChange={(v) => settingsStore.setRofBug(v)}
                class="switch-root"
              >
                <Switch.Thumb class="switch-thumb"></Switch.Thumb>
              </Switch.Root>
            </div>

            <div class="settings-item">
              <div class="flex items-center gap-3">
                <div class="settings-icon-wrapper">
                  <Diff class="h-5 w-5 text-foreground" />
                </div>
                <div class="settings-label-group">
                  <label for="see-value-difference" class="settings-label">
                    See Value Difference
                  </label>
                  <p class="settings-help-text">
                    Shows how much a value changed compared to the original.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="see-value-difference"
                checked={settingsStore.seeValueDifference}
                onCheckedChange={(v) => settingsStore.setSeeValueDifference(v)}
                class="switch-root"
              >
                <Switch.Thumb class="switch-thumb"></Switch.Thumb>
              </Switch.Root>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="appearance">
          <div class="settings-grid">
            <div class="settings-item">
              <div class="flex items-center gap-3">
                <div class="settings-icon-wrapper">
                  <Scaling class="h-5 w-5 text-foreground" />
                </div>
                <div class="settings-label-group">
                  <label for="min-content-table-width" class="settings-label">
                    Compact Table Width
                  </label>
                  <p class="settings-help-text">
                    Prevents the table from stretching to the full width,
                    keeping it only as wide as necessary.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="min-content-table-width"
                checked={settingsStore.minTableWidth}
                onCheckedChange={(v) => settingsStore.setMinTableWidth(v)}
                class="switch-root"
              >
                <Switch.Thumb class="switch-thumb"></Switch.Thumb>
              </Switch.Root>
            </div>

            <div class="settings-item">
              <div class="flex items-center gap-3">
                <div class="settings-icon-wrapper">
                  <SquareDashedBottom class="h-5 w-5 text-foreground" />
                </div>
                <div class="settings-label-group">
                  <label for="hide-cell-wrapper" class="settings-label">
                    Hide Cell Wrapper
                  </label>
                  <p class="settings-help-text">
                    Hides the visual wrapper inside table cells, letting the
                    number sit directly in the cell.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="hide-cell-wrapper"
                checked={settingsStore.hideCellWrapper}
                onCheckedChange={(v) => settingsStore.setHideCellWrapper(v)}
                class="switch-root"
              >
                <Switch.Thumb class="switch-thumb"></Switch.Thumb>
              </Switch.Root>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="advanced">
          <div class="settings-grid">
            <div class="settings-item">
              <div class="flex items-center gap-3">
                <div class="settings-icon-wrapper">
                  <ChartLine class="h-5 w-5 text-foreground" />
                </div>
                <div class="settings-label-group">
                  <label for="analytics-toggle" class="settings-label"
                    >Analytics</label
                  >
                  <p class="settings-help-text">
                    Help us improve by sharing anonymous usage data.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="analytics-toggle"
                checked={analyticsEnabled}
                onCheckedChange={(v) => analytics.setConsent(v)}
                class="switch-root"
              >
                <Switch.Thumb class="switch-thumb"></Switch.Thumb>
              </Switch.Root>
            </div>

            <div class="settings-item">
              <div class="flex items-center gap-3">
                <div class="settings-icon-wrapper">
                  <Bug class="h-5 w-5 text-foreground" />
                </div>
                <div class="settings-label-group">
                  <label for="debug-mode" class="settings-label">
                    Debug Mode
                  </label>
                  <p class="settings-help-text">
                    Enables detailed logging in the console.
                  </p>
                </div>
              </div>
              <Switch.Root
                id="debug-mode"
                checked={settingsStore.debugMode}
                onCheckedChange={(v) => settingsStore.setDebug(v)}
                class="switch-root"
              >
                <Switch.Thumb class="switch-thumb"></Switch.Thumb>
              </Switch.Root>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <div class="settings-footer">
        <Dialog.Close class="btn btn-secondary text-sm px-4 py-2">
          Close
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
