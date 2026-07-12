<script lang="ts">
  import type { Snippet } from "svelte";
  import { mergeProps } from "bits-ui";
  import Tip from "./Tip.svelte";

  let {
    class: className = "",
    children: icon,
    title,
    "aria-label": ariaLabel,
    ...restProps
  }: {
    class?: string;
    children: Snippet;
    title?: string;
    "aria-label"?: string;
    [key: string]: unknown;
  } = $props();

  const label = $derived(ariaLabel ?? title);
</script>

{#if title}
  <Tip content={title}>
    {#snippet children({ props })}
      <button
        class="icon-btn {className}"
        aria-label={label}
        {...mergeProps(props, restProps)}
      >
        {@render icon()}
      </button>
    {/snippet}
  </Tip>
{:else}
  <button class="icon-btn {className}" aria-label={ariaLabel} {...restProps}>
    {@render icon()}
  </button>
{/if}
