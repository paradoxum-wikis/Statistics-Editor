<script lang="ts">
  import type { Snippet } from "svelte";

  type BtnVariant =
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "destructive-fill";

  type BtnSize = "default" | "sm";

  let {
    variant = "primary",
    size = "default",
    class: className = "",
    children,
    ...restProps
  }: {
    variant?: BtnVariant;
    size?: BtnSize;
    class?: string;
    children: Snippet;
    [key: string]: unknown;
  } = $props();

  const variantClass: Record<BtnVariant, string> = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    outline: "btn-outline",
    ghost: "btn-ghost",
    destructive: "btn-destructive",
    "destructive-fill": "btn-destructive-fill",
  };
</script>

<button
  class="btn {variantClass[variant]} {size === 'sm'
    ? 'btn-sm'
    : ''} {className}"
  {...restProps}
>
  {@render children()}
</button>
