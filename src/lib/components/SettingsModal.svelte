<script lang="ts">
    import { Dialog, Switch } from "bits-ui";
    import { settingsStore } from "$lib/stores/settings.svelte";

    let { open = $bindable(false) } = $props();
</script>

<Dialog.Root bind:open>
    <Dialog.Portal>
        <Dialog.Overlay
            class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        ></Dialog.Overlay>
        <Dialog.Content
            class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg"
        >
            <div class="flex flex-col space-y-1.5 text-center sm:text-left">
                <Dialog.Title
                    class="text-lg font-semibold leading-none tracking-tight text-heading"
                >
                    Settings
                </Dialog.Title>
                <Dialog.Description class="text-sm text-muted-foreground">
                    Manage your application preferences.
                </Dialog.Description>
            </div>

            <div class="grid gap-4 py-4">
                <div
                    class="flex items-center justify-between space-x-2 p-4 rounded-lg border border-border bg-secondary/10"
                >
                    <div class="space-y-1">
                        <label
                            for="debug-mode"
                            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Debug Mode
                        </label>
                        <p class="text-xs text-muted-foreground">
                            Enables detailed logging in the console.
                        </p>
                    </div>
                    <Switch.Root
                        id="debug-mode"
                        checked={settingsStore.debugMode}
                        onCheckedChange={(v) => settingsStore.setDebug(v)}
                        class="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-200"
                    >
                        <Switch.Thumb
                            class="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
                        ></Switch.Thumb>
                    </Switch.Root>
                </div>

                <div
                    class="flex items-center justify-between space-x-2 p-4 rounded-lg border border-border bg-secondary/10"
                >
                    <div class="space-y-1">
                        <label
                            for="see-value-difference"
                            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            See value difference
                        </label>
                        <p class="text-xs text-muted-foreground">
                            Shows how much a value changed compared to the
                            original.
                        </p>
                    </div>
                    <Switch.Root
                        id="see-value-difference"
                        checked={settingsStore.seeValueDifference}
                        onCheckedChange={(v) =>
                            settingsStore.setSeeValueDifference(v)}
                        class="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-200"
                    >
                        <Switch.Thumb
                            class="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
                        ></Switch.Thumb>
                    </Switch.Root>
                </div>
            </div>

            <div class="flex items-center justify-end">
                <Dialog.Close class="btn-secondary text-sm px-4 py-2">
                    Close
                </Dialog.Close>
            </div>
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
