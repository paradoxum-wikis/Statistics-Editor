<script lang="ts">
  import type { Snippet } from "svelte";
  import { Dialog } from "bits-ui";
  import { X } from "@lucide/svelte";

  let {
    open = $bindable(false),
    title,
    description,
    class: className,
    onOpenChange,
    trigger,
    children,
    footer,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    class?: string;
    onOpenChange?: (open: boolean) => void;
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
    children?: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<Dialog.Root
  {open}
  onOpenChange={(next) => {
    open = next;
    onOpenChange?.(next);
  }}
>
  {#if trigger}
    <Dialog.Trigger>
      {#snippet child({ props })}
        {@render trigger({ props })}
      {/snippet}
    </Dialog.Trigger>
  {/if}

  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay"></Dialog.Overlay>
    <Dialog.Content class={["dialog-content", className]}>
      {#if title}
        <div class="flex flex-col space-y-1.5 pe-8 text-center sm:text-start">
          <Dialog.Title class="dialog-title">{title}</Dialog.Title>
          {#if description}
            <Dialog.Description class="dialog-description">
              {description}
            </Dialog.Description>
          {/if}
        </div>
      {/if}

      {@render children?.()}

      {#if footer}
        {@render footer()}
      {/if}

      <Dialog.Close class="icon-btn absolute right-3 top-3" aria-label="Close">
        <X size={16} />
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
