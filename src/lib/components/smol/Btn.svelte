<script lang="ts">
  import type { Snippet } from "svelte";
  import Tip from "./Tip.svelte";

  type BtnVariant =
    "primary" | "secondary" | "outline" | "destructive" | "destructive-fill";

  type BtnSize = "default" | "sm";

  let {
    variant = "primary",
    size = "default",
    class: className = "",
    children: label,
    title,
    ...restProps
  }: {
    variant?: BtnVariant;
    size?: BtnSize;
    class?: string;
    children: Snippet;
    title?: string;
    [key: string]: unknown;
  } = $props();

  const variantClass: Record<BtnVariant, string> = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    outline: "btn-outline",
    destructive: "btn-destructive",
    "destructive-fill": "btn-destructive-fill",
  };

  const btnClass = $derived(
    `btn ${variantClass[variant]} ${size === "sm" ? "btn-sm" : ""} ${className}`,
  );
</script>

{#if title}
  <Tip content={title}>
    {#snippet children({ props })}
      <button class={btnClass} {...restProps} {...props}>
        {@render label()}
      </button>
    {/snippet}
  </Tip>
{:else}
  <button class={btnClass} {...restProps}>
    {@render label()}
  </button>
{/if}
