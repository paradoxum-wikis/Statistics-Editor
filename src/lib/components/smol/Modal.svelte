<script lang="ts">
  import type { Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { Dialog } from "bits-ui";
  import { Drawer } from "vaul-svelte";

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

  const desktop = new MediaQuery("min-width: 768px");

  function setOpen(next: boolean) {
    open = next;
    onOpenChange?.(next);
  }
</script>

{#if desktop.current}
  <Dialog.Root {open} onOpenChange={setOpen}>
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
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{:else}
  <Drawer.Root {open} onOpenChange={setOpen} shouldScaleBackground={false}>
    {#if trigger}
      <Drawer.Trigger>
        {#snippet child({ props })}
          {@render trigger({ props })}
        {/snippet}
      </Drawer.Trigger>
    {/if}

    <Drawer.Portal>
      <Drawer.Overlay class="dialog-overlay"></Drawer.Overlay>
      <Drawer.Content
        class={[
          "fixed inset-x-0 bottom-0 z-47 flex h-auto max-h-[92dvh] flex-col rounded-t-(--radius) border border-b-0 border-border bg-background px-5 pb-6 outline-none",
          className,
        ]}
      >
        <!-- margin on the handle so consumer p-0 doesn't flush the pill to the edge -->
        <Drawer.Handle
          class="relative mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35"
        />

        <div
          class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto touch-pan-y"
        >
          {#if title}
            <div class="flex flex-col space-y-1.5 text-center">
              <Drawer.Title class="dialog-title">{title}</Drawer.Title>
              {#if description}
                <Drawer.Description class="dialog-description">
                  {description}
                </Drawer.Description>
              {/if}
            </div>
          {/if}

          {@render children?.()}

          {#if footer}
            {@render footer()}
          {/if}
        </div>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
{/if}

<style>
  :global([data-vaul-drawer]) {
    touch-action: none;
    will-change: transform;

    &:not([data-vaul-custom-container="true"])::after {
      content: "";
      position: absolute;
      background: inherit;
    }

    &[data-vaul-drawer-direction="bottom"]::after {
      top: 100%;
      right: 0;
      left: 0;
      height: 200%;
    }

    &[data-vaul-drawer-direction="left"]::after {
      top: 0;
      right: 100%;
      bottom: 0;
      width: 200%;
    }
  }

  :global([data-vaul-handle-hitarea]) {
    position: absolute;
    top: 50%;
    left: 50%;
    width: max(100%, 2.75rem);
    height: max(100%, 2.75rem);
    translate: -50% -50%;
    touch-action: inherit;
  }
</style>
