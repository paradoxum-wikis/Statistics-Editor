<script lang="ts">
  import { fly } from "svelte/transition";
  import { CircleCheck, CircleX, Info, TriangleAlert, X } from "@lucide/svelte";
  import { toastStore } from "$lib/stores/toast.svelte";

  const iconByColor = {
    info: Info,
    success: CircleCheck,
    error: CircleX,
    warning: TriangleAlert,
  };
</script>

<div
  class="pointer-events-none fixed right-4 bottom-4 z-67 flex w-[min(100vw-2rem,22rem)] flex-col gap-2 max-md:bottom-17"
  aria-live="polite"
>
  {#each toastStore.items as item (item.id)}
    {@const Icon = iconByColor[item.color]}
    <div
      class={["toast", item.color, item.description || item.action ? "rich" : ""]}
      role={item.color === "error" ? "alert" : "status"}
      in:fly={{ x: 16, duration: 180 }}
      out:fly={{ x: 16, duration: 140 }}
    >
      <Icon class="shrink-0" size={16} aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p>{item.message}</p>
        {#if item.description}
          <p class="desc">{item.description}</p>
        {/if}
        {#if item.action}
          <button
            type="button"
            class="action"
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
        class="dismiss"
        aria-label="Dismiss"
        onclick={() => toastStore.dismiss(item.id)}
      >
        <X size={16} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast {
    --btn-rim: oklch(from var(--btn) min(0.95, calc(l + 0.12)) c h);
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 2px solid var(--btn-rim);
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--btn) 0%, var(--btn-deep) 100%);
    padding: 0.375rem 0.875rem;
    color: oklch(100% 0 0);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    -webkit-text-stroke: var(--text-stroke-width) var(--text-stroke-color);
    paint-order: stroke fill;

    &.info {
      --btn: var(--primary);
      --btn-deep: var(--primary-dark);
    }
    &.success {
      --btn: var(--green);
      --btn-deep: var(--green-dark);
    }
    &.error {
      --btn: var(--destructive);
      --btn-deep: var(--destructive-dark);
    }
    &.warning {
      --btn: var(--yellow);
      --btn-deep: var(--yellow-dark);
    }

    &.rich {
      align-items: flex-start;
    }

    .desc {
      margin-top: 0.125rem;
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.35;
      color: oklch(100% 0 0 / 0.82);
    }

    .action {
      margin-top: 0.375rem;
      border: 2px solid oklch(100% 0 0 / 0.85);
      border-radius: var(--radius);
      background: oklch(100% 0 0 / 0.16);
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      -webkit-text-stroke: 0;

      &:hover {
        background: oklch(100% 0 0 / 0.26);
      }
    }

    .dismiss {
      display: flex;
      width: 1.75rem;
      height: 1.75rem;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius);
      opacity: 0.8;
      -webkit-text-stroke: 0;

      &:hover {
        background: oklch(100% 0 0 / 0.16);
        opacity: 1;
      }
    }
  }
</style>
