<script lang="ts">
    import { Dialog, Switch } from "bits-ui";
    import { settingsStore } from "$lib/stores/settings.svelte";

    let { open = $bindable(false) } = $props();
</script>

<Dialog.Root bind:open>
    <Dialog.Portal>
        <Dialog.Overlay class="settings-overlay"></Dialog.Overlay>
        <Dialog.Content class="settings-content">
            <div class="settings-header">
                <Dialog.Title class="settings-title">
                    Settings
                </Dialog.Title>
                <Dialog.Description class="settings-description">
                    Manage your application preferences.
                </Dialog.Description>
            </div>

            <div class="settings-grid">
                <div class="settings-item">
                    <div class="settings-label-group">
                        <label for="debug-mode" class="settings-label">
                            Debug Mode
                        </label>
                        <p class="settings-help-text">
                            Enables detailed logging in the console.
                        </p>
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

                <div class="settings-item">
                    <div class="settings-label-group">
                        <label
                            for="see-value-difference"
                            class="settings-label"
                        >
                            See value difference
                        </label>
                        <p class="settings-help-text">
                            Shows how much a value changed compared to the
                            original.
                        </p>
                    </div>
                    <Switch.Root
                        id="see-value-difference"
                        checked={settingsStore.seeValueDifference}
                        onCheckedChange={(v) =>
                            settingsStore.setSeeValueDifference(v)}
                        class="switch-root"
                    >
                        <Switch.Thumb class="switch-thumb"></Switch.Thumb>
                    </Switch.Root>
                </div>
            </div>

            <div class="settings-footer">
                <Dialog.Close class="btn btn-secondary text-sm px-4 py-2">
                    Close
                </Dialog.Close>
            </div>
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
