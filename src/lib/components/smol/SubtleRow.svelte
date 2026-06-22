<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    class: className = "",
    children,
    ...restProps
  }: {
    class?: string;
    children: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<div
  class="rounded-[calc(var(--radius)-0.25rem)_0] border border-border bg-secondary/10 {className}"
  {...restProps}
>
  {@render children()}
</div>
