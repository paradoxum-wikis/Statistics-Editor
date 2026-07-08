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

  const colorClass: Record<ToastColor, string> = {
    info: "border-chart-5",
    success: "border-chart-2",
    error: "border-chart-1",
    warning: "border-chart-4",
  };

  const iconClass: Record<ToastColor, string> = {
    info: "text-chart-5",
    success: "text-chart-2",
    error: "text-chart-1",
    warning: "text-chart-4",
  };
</script>

<div
  class="pointer-events-none fixed right-4 bottom-4 z-67 flex w-[min(100vw-2rem,20rem)] flex-col gap-2 max-md:bottom-17"
  aria-live="polite"
>
  {#each toastStore.items as item (item.id)}
    {@const Icon = iconByColor[item.color]}
    <div
      class="group pointer-events-auto relative flex items-center gap-2 rounded-[var(--radius)_0] border bg-secondary px-2 py-1.5 text-sm text-foreground shadow-md {colorClass[
        item.color
      ]}"
      role={item.color === "error" ? "alert" : "status"}
      in:fly={{ x: 16, duration: 180 }}
      out:fly={{ x: 16, duration: 140 }}
    >
      <span
        class="flex size-6 shrink-0 items-center justify-center rounded-[calc(var(--radius)-0.5rem)_0] {iconClass[
          item.color
        ]}"
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
