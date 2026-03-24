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
                            See Value Difference
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

                <div class="settings-item">
                    <div class="settings-label-group">
                        <label
                            for="hide-cell-wrapper"
                            class="settings-label"
                        >
                            Hide Cell Wrapper
                        </label>
                        <p class="settings-help-text">
                            Hides the visual wrapper inside table cells, letting the number sit directly in the cell.
                        </p>
                    </div>
                    <Switch.Root
                        id="hide-cell-wrapper"
                        checked={settingsStore.hideCellWrapper}
                        onCheckedChange={(v) =>
                            settingsStore.setHideCellWrapper(v)}
                        class="switch-root"
                    >
                        <Switch.Thumb class="switch-thumb"></Switch.Thumb>
                    </Switch.Root>
                </div>

                <div class="settings-item">
                    <div class="settings-label-group">
                        <label
                            for="min-content-table-width"
                            class="settings-label"
                        >
                        	Compact Table Width
                        </label>
                        <p class="settings-help-text">
                            Prevents the table from stretching to the full width, keeping it only as wide as necessary.
                        </p>
                    </div>
                    <Switch.Root
                        id="min-content-table-width"
                        checked={settingsStore.minTableWidth}
                        onCheckedChange={(v) =>
                            settingsStore.setMinTableWidth(v)}
                        class="switch-root"
                    >
                        <Switch.Thumb class="switch-thumb"></Switch.Thumb>
                    </Switch.Root>
                </div>

                <div class="settings-item">
                    <div class="settings-label-group">
                        <label
                            for="clear-on-edit"
                            class="settings-label"
                        >
                            Clear Cell on Edit
                        </label>
                        <p class="settings-help-text">
                            Clears the input box when you click on a cell instead of keeping whatever was already there.
                        </p>
                    </div>
                    <Switch.Root
                        id="clear-on-edit"
                        checked={settingsStore.clearOnEdit}
                        onCheckedChange={(v) =>
                            settingsStore.setClearOnEdit(v)}
                        class="switch-root"
                    >
                        <Switch.Thumb class="switch-thumb"></Switch.Thumb>
                    </Switch.Root>
                </div>

                <div class="settings-item">
                    <div class="settings-label-group">
                        <label
                            for="rof-bug"
                            class="settings-label"
                        >
                        	ROF Bug
                        </label>
                        <p class="settings-help-text">
                        	Calculate statistics with the infamous Rate of Fire bug.
                        </p>
                    </div>
                    <Switch.Root
                        id="rof-bug"
                        checked={settingsStore.rofBug}
                        onCheckedChange={(v) =>
                            settingsStore.setRofBug(v)}
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
