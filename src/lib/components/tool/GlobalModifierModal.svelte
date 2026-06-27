<script lang="ts">
  import { Dialog } from "bits-ui";
  import { X } from "@lucide/svelte";
  import GlobalModifierPanel from "./GlobalModifierPanel.svelte";

  let { open = $bindable(false) } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="settings-overlay"></Dialog.Overlay>
    <Dialog.Content
      class="settings-content sm:max-w-2xl max-h-[85dvh] overflow-y-auto"
    >
      <GlobalModifierPanel />

      <Dialog.Close class="icon-btn absolute right-3 top-3" aria-label="Close">
        <X size={16} />
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
