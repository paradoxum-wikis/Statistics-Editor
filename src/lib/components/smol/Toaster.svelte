<script lang="ts">
  import { fly } from "svelte/transition";
  import { CircleCheck, CircleX, Info, TriangleAlert, X } from "@lucide/svelte";
  import { toastStore } from "$lib/stores/toast.svelte";
  import type { ToastColor } from "$lib/stores/toast.svelte";

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
  class="pointer-events-none fixed right-4 bottom-4 z-67 flex w-[min(100vw-2rem,20rem)] flex-col gap-2 max-md:bottom-17"
  aria-live="polite"
>
  {#each toastStore.items as item (item.id)}
    {@const Icon = iconByColor[item.color]}
    <div
      class="toast group pointer-events-auto relative flex items-center gap-2 rounded-md border border-border bg-popover px-2 py-2 text-sm text-foreground shadow-md"
      style:--toast-color={colorVar[item.color]}
      role={item.color === "error" ? "alert" : "status"}
      in:fly={{ x: 16, duration: 180 }}
      out:fly={{ x: 16, duration: 140 }}
    >
      <span
        class="toast-icon flex size-6 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <Icon class="size-4" />
      </span>
      <span class="min-w-0 flex-1 pe-6 leading-snug">{item.message}</span>
      <button
        type="button"
        class="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer p-0.5 pe-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive max-md:opacity-100"
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
    border-left: 3px solid var(--toast-color);
  }

  .toast-icon {
    color: var(--toast-color);
  }
</style>
