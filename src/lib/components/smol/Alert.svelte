<script lang="ts">
  import type { Snippet } from "svelte";
  import { Dialog } from "bits-ui";

  let {
    open = $bindable(false),
    title,
    description = "",
    body,
    cancelLabel = "Cancel",
    confirmLabel,
    cancelClass = "btn btn-outline mt-2 sm:mt-0",
    confirmClass = "btn btn-primary",
    onConfirm,
    onCancel,
  }: {
    open?: boolean;
    title: string;
    description?: string;
    body?: Snippet;
    cancelLabel?: string;
    confirmLabel?: string;
    cancelClass?: string;
    confirmClass?: string;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  } = $props();

  let confirming = $state(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && open && !confirming) {
      onCancel?.();
    }
    open = nextOpen;
  }

  async function handleConfirm() {
    confirming = true;
    await onConfirm?.();
    open = false;
    confirming = false;
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay"></Dialog.Overlay>
    <Dialog.Content class="dialog-content">
      <div class="flex flex-col space-y-2 text-center sm:text-start">
        <Dialog.Title class="text-lg font-semibold">
          {title}
        </Dialog.Title>
        <Dialog.Description class="text-sm text-muted-foreground">
          {#if body}
            {@render body()}
          {:else}
            {description}
          {/if}
        </Dialog.Description>
      </div>
      <div
        class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"
      >
        <Dialog.Close class={cancelClass} onclick={onCancel}>
          {cancelLabel}
        </Dialog.Close>
        {#if confirmLabel}
          <button type="button" class={confirmClass} onclick={handleConfirm}>
            {confirmLabel}
          </button>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
