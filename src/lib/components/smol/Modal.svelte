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
    header,
    children,
    footer,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    class?: string;
    onOpenChange?: (open: boolean) => void;
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
    header?: Snippet;
    children?: Snippet;
    footer?: Snippet;
  } = $props();

  const desktop = new MediaQuery("min-width: 768px");

  function setOpen(next: boolean) {
    open = next;
    onOpenChange?.(next);
  }
</script>

{#snippet closeBtn()}
  <button
    type="button"
    class="close"
    aria-label="Close"
    onclick={() => setOpen(false)}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
      />
    </svg>
  </button>
{/snippet}

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
        {#if header}
          {#if title}<Dialog.Title class="sr-only">{title}</Dialog.Title>{/if}
          {#if description}
            <Dialog.Description class="sr-only"
              >{description}</Dialog.Description
            >
          {/if}
          {@render header()}
        {:else if title}
          <div class="flex items-start justify-between gap-3">
            <div
              class="flex min-w-0 flex-1 flex-col space-y-1.5 text-center sm:text-start"
            >
              <Dialog.Title class="dialog-title">{title}</Dialog.Title>
              {#if description}
                <Dialog.Description class="dialog-description">
                  {description}
                </Dialog.Description>
              {/if}
            </div>
            {@render closeBtn()}
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
          "fixed inset-x-0 bottom-0 z-47 flex h-auto max-h-[92dvh] flex-col rounded-t-lg border border-b-0 border-border bg-transparent px-5 pb-6 outline-none",
          className,
        ]}
      >
        <Drawer.Handle
          class="relative mx-auto mt-3 mb-6 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35"
        />

        <div
          class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto touch-pan-y"
        >
          {#if header}
            {#if title}<Drawer.Title class="sr-only">{title}</Drawer.Title>{/if}
            {#if description}
              <Drawer.Description class="sr-only"
                >{description}</Drawer.Description
              >
            {/if}
            {@render header()}
          {:else if title}
            <div class="flex items-start justify-between gap-3">
              <div
                class="flex min-w-0 flex-1 flex-col space-y-1.5 text-center sm:text-start"
              >
                <Drawer.Title class="dialog-title">{title}</Drawer.Title>
                {#if description}
                  <Drawer.Description class="dialog-description">
                    {description}
                  </Drawer.Description>
                {/if}
              </div>
              {@render closeBtn()}
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
    background: var(--popover);
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

    :global([data-vaul-handle]) {
      background: var(--foreground);
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

  /* The mobile bottom drawer already exposes a swipe-down handle/hint,
     so a dedicated X close button is redundant there. */
  :global([data-vaul-drawer-direction="bottom"] .close) {
    display: none;
  }
</style>
