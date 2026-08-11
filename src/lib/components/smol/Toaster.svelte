<script lang="ts">
  import { fly } from "svelte/transition";
  import { CircleCheck, CircleX, Info, TriangleAlert, X } from "@lucide/svelte";
  import { toastStore, type ToastColor } from "$lib/stores/toast.svelte";

  const iconByColor: Record<
    ToastColor,
    typeof CircleCheck | typeof CircleX | typeof Info | typeof TriangleAlert
  > = {
    info: Info,
    success: CircleCheck,
    error: CircleX,
    warning: TriangleAlert,
  };

  const colorVar: Record<ToastColor, string> = {
    info: "var(--primary)",
    success: "var(--green)",
    error: "var(--destructive)",
    warning: "var(--yellow)",
  };
</script>

<div
  class="pointer-events-none fixed right-4 bottom-4 z-67 flex w-[min(100vw-2rem,22rem)] flex-col gap-2 max-md:bottom-17"
  aria-live="polite"
>
  {#each toastStore.items as item (item.id)}
    {@const Icon = iconByColor[item.color]}
    <div
      class="toast group pointer-events-auto relative flex gap-2 rounded-md border border-border bg-popover px-2 py-2 text-sm text-foreground shadow-md"
      data-rich={item.description || item.action ? "" : undefined}
      style:--toast-color={colorVar[item.color]}
      role={item.color === "error" ? "alert" : "status"}
      in:fly={{ x: 16, duration: 180 }}
      out:fly={{ x: 16, duration: 140 }}
    >
      <span class="toast-icon" aria-hidden="true">
        <Icon class="size-4" />
      </span>
      <div class="toast-body">
        <p class="toast-message">{item.message}</p>
        {#if item.description}
          <p class="toast-desc">{item.description}</p>
        {/if}
        {#if item.action}
          <button
            type="button"
            class="toast-action"
            onclick={() => {
              item.action?.onClick();
              toastStore.dismiss(item.id);
            }}
          >
            {item.action.label}
          </button>
        {/if}
      </div>
      <button
        type="button"
        class="toast-dismiss"
        aria-label="Dismiss"
        onclick={() => toastStore.dismiss(item.id)}
      >
        <X class="size-3.5" />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast {
    align-items: center;
    border-left: 3px solid var(--toast-color);

    &[data-rich] {
      align-items: flex-start;
    }
  }

  .toast-icon {
    display: flex;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    margin-top: 0.125rem;
    color: var(--toast-color);
  }

  .toast-body {
    flex: 1 1 auto;
    min-width: 0;
    padding-inline-end: 1.5rem;
  }

  .toast-message {
    font-weight: 500;
    line-height: 1.35;
  }

  .toast-desc {
    margin-top: 0.125rem;
    font-size: 0.75rem;
    line-height: 1.35;
    color: var(--muted-foreground);
  }

  .toast-action {
    margin-top: 0.375rem;
    color: var(--toast-color);
    font-size: 0.75rem;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;

    &:hover {
      filter: brightness(1.08);
    }
  }

  .toast-dismiss {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    padding: 0.125rem 0.375rem 0.125rem 0.125rem;
    color: var(--muted-foreground);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;

    .group:hover &,
    .group:focus-within & {
      opacity: 1;
    }

    &:hover {
      color: var(--destructive);
    }

    @media (max-width: 767px) {
      opacity: 1;
    }
  }
</style>
