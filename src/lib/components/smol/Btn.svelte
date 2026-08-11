<script lang="ts">
  import type { Snippet } from "svelte";
  import { mergeProps } from "bits-ui";
  import Tip from "./Tip.svelte";

  type BtnVariant =
    "primary" | "secondary" | "outline" | "destructive" | "destructive-fill";

  let {
    variant = "primary",
    class: className = "",
    children: label,
    title,
    ...restProps
  }: {
    variant?: BtnVariant;
    class?: string;
    children: Snippet;
    title?: string;
    [key: string]: unknown;
  } = $props();

  const variantClass: Record<BtnVariant, string> = {
    primary: "primary",
    secondary: "secondary",
    outline: "outline",
    destructive: "destructive",
    "destructive-fill": "destructive-fill",
  };

  const btnClass = $derived(`btn ${variantClass[variant]} ${className}`);
</script>

{#if title}
  <Tip content={title}>
    {#snippet children({ props })}
      {#if restProps.disabled}
        <span class="inline-flex" {...props}>
          <button class={btnClass} {...restProps}>
            {@render label()}
          </button>
        </span>
      {:else}
        <button class={btnClass} {...mergeProps(props, restProps)}>
          {@render label()}
        </button>
      {/if}
    {/snippet}
  </Tip>
{:else}
  <button class={btnClass} {...restProps}>
    {@render label()}
  </button>
{/if}
