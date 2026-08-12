<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import placeholder from "$lib/assets/Placeholder.png";
  import { imageLoader } from "$lib/services/imageLoader";

  let {
    name,
    image,
    tier,
    selected,
    class: className,
    onclick,
    ...rest
  }: {
    name: string;
    image?: string;
    tier?: string;
    selected?: boolean;
    class?: string;
  } & HTMLButtonAttributes = $props();

  let src = $state(placeholder);

  $effect(() => {
    const ref = image?.trim();
    src = placeholder;
    if (!ref) return;
    const cached = imageLoader.getCachedUrl(name, -1, ref);
    if (cached) {
      src = cached;
      return;
    }
    let cancelled = false;
    imageLoader.loadImage(name, -1, ref).then((url) => {
      if (!cancelled && url) src = url;
    });
    return () => {
      cancelled = true;
    };
  });
</script>

<button
  type="button"
  class={[className, { selected }]}
  data-tier={tier}
  {onclick}
  {...rest}
>
  <img {src} alt="" loading="lazy" />
  <span>{name}</span>
</button>

<style>
  button {
    --tower-tier: oklch(0.777 0.077 77);
    --tower-fill: oklch(from var(--tower-tier) 0.78 calc(c * 0.36) h);
    --tower-well: oklch(from var(--tower-tier) 0.54 calc(c * 0.28) h);
    --fog: oklch(1 0 0);
    position: relative;
    width: 8.325rem;
    aspect-ratio: 1 / 1.2;
    padding: 0;
    overflow: hidden;
    border: 2px solid var(--tower-tier);
    border-radius: var(--radius);
    background:
      linear-gradient(
        to bottom,
        color-mix(in oklch, var(--fog) 85%, transparent) 0%,
        color-mix(in oklch, var(--fog) 5%, transparent) 42%,
        color-mix(in oklch, var(--fog) 10%, transparent) 100%
      ),
      linear-gradient(
        to bottom,
        var(--tower-well) 5%,
        var(--tower-fill) 20%,
        var(--tower-tier) 100%
      );
    color: oklch(100% 0 0);
    transition:
      transform 0.08s,
      box-shadow 0.1s;

    :global(.dark) & {
      --fog: oklch(0 0 0);
      --tower-fill: oklch(from var(--tower-tier) 0.36 calc(c * 0.7) h);
      --tower-well: oklch(from var(--tower-tier) 0.2 calc(c * 0.42) h);
    }

    &[data-tier="Starter"] {
      --tower-tier: oklch(0.755 0 0);
    }
    &[data-tier="Intermediate"] {
      --tower-tier: oklch(0.885 0.221 148);
    }
    &[data-tier="Advanced"] {
      --tower-tier: oklch(0.707 0.168 242);
    }
    &[data-tier="Hardcore"] {
      --tower-tier: oklch(0.635 0.241 303);
    }
    &[data-tier="Evolved"] {
      --tower-tier: oklch(0.778 0.133 197);
    }
    &[data-tier="Exclusive"] {
      --tower-tier: oklch(0.688 0.241 350.5);
    }
    &[data-tier="Golden Perks"] {
      --tower-tier: oklch(0.932 0.211 104);
    }
    &[data-tier="Unavailable"] {
      --tower-tier: oklch(0.628 0.258 30);
    }

    &:hover {
      box-shadow:
        0 6px 12px color-mix(in oklch, var(--tower-tier) 50%, transparent),
        0 0 12px color-mix(in oklch, var(--tower-tier) 35%, transparent);

      transform: scale(1.05);
      transition:
        transform 0.25s cubic-bezier(0.1, 1.55, 0.65, 1),
        box-shadow 0.25s ease-in;
    }

    &.selected {
      box-shadow:
        0 0 0 1px oklch(100% 0 0),
        0 0 12px color-mix(in oklch, var(--tower-tier) 50%, transparent);
    }

    &::before {
      content: "";
      position: absolute;
      inset: 0.575rem;
      border: 2px solid color-mix(in oklch, var(--tower-tier) 45%, transparent);
      border-radius: calc(var(--radius) - 0.25rem);
      pointer-events: none;
    }

    &::after {
      content: "";
      position: absolute;
      top: 0.2rem;
      left: 0.2rem;
      z-index: 7;
      width: 0.75rem;
      height: 0.75rem;
      background: oklch(100% 0 0);
      clip-path: polygon(0 0, 100% 0, 0 100%);
      pointer-events: none;
    }
  }

  img {
    position: relative;
    z-index: 7;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  span {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 7;
    padding: 0.2rem 0.3rem 0.3rem;
    overflow: hidden;
    font-size: 0.75rem;
    font-weight: 700;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    -webkit-text-stroke: var(--text-stroke-width) var(--text-stroke-color);
    paint-order: stroke fill;
  }
</style>
