<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import IconBtn from "./IconBtn.svelte";

  const GAP_PX = 12; // gap-3
  const TRANSITION_MS = 300;

  interface Props {
    items: T[];
    getKey: (item: T) => string | number;
    label: string;
    title?: string;
    maxPerView?: number;
    autoplayMs?: number;
    class?: string;
    slide: Snippet<[{ item: T; index: number }]>;
  }

  let {
    items,
    getKey,
    label,
    title,
    maxPerView = 2,
    autoplayMs = 5500,
    class: className = "",
    slide,
  }: Props = $props();

  let index = $state(0);
  let perView = $state(1);
  let animating = $state(false);
  let paused = $state(false);
  let viewportEl = $state<HTMLDivElement | null>(null);
  let trackEl = $state<HTMLDivElement | null>(null);
  let cardPx = $state(0);

  let wrapping = false;
  let wrapTimer: ReturnType<typeof setTimeout> | null = null;

  const stepPx = $derived(cardPx > 0 ? cardPx + GAP_PX : 0);
  const trackItems = $derived(
    items.length
      ? [...items, ...items.slice(0, Math.min(perView, items.length))]
      : [],
  );
  const activeDot = $derived(items.length ? index % items.length : 0);

  function clearWrapTimer() {
    if (wrapTimer == null) return;
    clearTimeout(wrapTimer);
    wrapTimer = null;
  }

  function measure() {
    const vp = viewportEl;
    if (!vp || vp.clientWidth <= 0) return;
    cardPx = (vp.clientWidth - GAP_PX * (perView - 1)) / perView;
  }

  function snapFromClone() {
    clearWrapTimer();
    wrapping = false;
    if (index < items.length) return;
    animating = false;
    index -= items.length;
    void trackEl?.offsetWidth;
  }

  function goTo(i: number, withAnim = true) {
    if (!items.length) return;
    const clamped = Math.max(0, Math.min(i, items.length));
    animating = withAnim;
    index = clamped;
    clearWrapTimer();

    if (clamped >= items.length && withAnim) {
      wrapping = true;
      wrapTimer = setTimeout(snapFromClone, TRANSITION_MS + 50);
    } else {
      wrapping = false;
    }
  }

  function next() {
    if (items.length < 2 || stepPx <= 0 || wrapping) return;
    goTo(index + 1);
  }

  function prev() {
    if (items.length < 2 || stepPx <= 0 || wrapping) return;
    if (index > 0) {
      goTo(index - 1);
      return;
    }
    wrapping = true;
    animating = false;
    index = items.length;
    void trackEl?.offsetWidth;
    requestAnimationFrame(() => goTo(items.length - 1, true));
  }

  function onTransitionEnd(e: TransitionEvent) {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    snapFromClone();
  }

  $effect(() => {
    items.length;
    maxPerView;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      const n = mq.matches
        ? Math.min(maxPerView, Math.max(1, items.length))
        : 1;
      if (n !== perView) {
        perView = n;
        index = 0;
        animating = false;
        wrapping = false;
        clearWrapTimer();
      }
      measure();
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      clearWrapTimer();
    };
  });

  $effect(() => {
    const el = viewportEl;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (paused || items.length < 2 || autoplayMs <= 0) return;
    const id = window.setInterval(() => {
      if (!wrapping) next();
    }, autoplayMs);
    return () => clearInterval(id);
  });
</script>

{#if items.length}
  <section
    class={className}
    aria-roledescription="carousel"
    aria-label={label}
    onmouseenter={() => (paused = true)}
    onmouseleave={() => (paused = false)}
    onfocusin={() => (paused = true)}
    onfocusout={() => (paused = false)}
  >
    {#if title || items.length > 1}
      <div class="mb-2 flex items-center justify-between gap-2">
        {#if title}
          <h2 class="text-sm font-semibold">{title}</h2>
        {/if}
        {#if items.length > 1}
          <div class="ml-auto flex items-center gap-0.5">
            <IconBtn
              class="p-1.5"
              title="Previous"
              aria-label={`Previous ${label}`}
              onclick={prev}
            >
              <ChevronLeft size={16} />
            </IconBtn>
            <div class="flex items-center gap-1.5 px-1">
              {#each items as _, i (i)}
                <button
                  type="button"
                  class="size-1.5 rounded-full transition-colors duration-200 {i ===
                  activeDot
                    ? 'bg-foreground'
                    : 'bg-muted-foreground/35 hover:bg-muted-foreground/55'}"
                  aria-label={`Slide ${i + 1}`}
                  aria-current={i === activeDot ? "true" : undefined}
                  onclick={() => {
                    if (!wrapping) goTo(i);
                  }}
                ></button>
              {/each}
            </div>
            <IconBtn
              class="p-1.5"
              title="Next"
              aria-label={`Next ${label}`}
              onclick={next}
            >
              <ChevronRight size={16} />
            </IconBtn>
          </div>
        {/if}
      </div>
    {/if}

    <div bind:this={viewportEl} class="overflow-hidden">
      <div
        bind:this={trackEl}
        class="flex will-change-transform {animating
          ? 'transition-transform duration-300 ease-out'
          : ''}"
        style="gap: {GAP_PX}px; transform: translate3d(-{index * stepPx}px,0,0)"
        ontransitionend={onTransitionEnd}
      >
        {#each trackItems as item, ti (`${getKey(item)}-${ti}`)}
          <div
            class="min-w-0 shrink-0"
            style="width: {cardPx}px"
            aria-hidden={ti >= items.length ? "true" : undefined}
          >
            {@render slide({ item, index: ti % items.length })}
          </div>
        {/each}
      </div>
    </div>
  </section>
{/if}
