<script lang="ts">
  import type { Snippet } from "svelte";
  import Modal from "./Modal.svelte";

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
  }

  async function handleConfirm() {
    confirming = true;
    await onConfirm?.();
    open = false;
    confirming = false;
  }
</script>

<Modal
  bind:open
  {title}
  description={body ? undefined : description}
  onOpenChange={handleOpenChange}
>
  {#if body}
    <div class="text-center text-sm text-muted-foreground sm:text-start">
      {@render body()}
    </div>
  {/if}

  {#snippet footer()}
    <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
      <button
        type="button"
        class={cancelClass}
        onclick={() => {
          onCancel?.();
          open = false;
        }}
      >
        {cancelLabel}
      </button>
      {#if confirmLabel}
        <button type="button" class={confirmClass} onclick={handleConfirm}>
          {confirmLabel}
        </button>
      {/if}
    </div>
  {/snippet}
</Modal>
