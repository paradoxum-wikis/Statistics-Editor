<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import IconBtn from "./IconBtn.svelte";

  const GAP_PX = 12; // gap-3

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
  let animating = $state(true);
  let paused = $state(false);
  let viewportEl = $state<HTMLDivElement | null>(null);
  let cardPx = $state(0);

  const stepPx = $derived(cardPx > 0 ? cardPx + GAP_PX : 0);
  const trackItems = $derived(
    items.length
      ? [...items, ...items.slice(0, Math.min(perView, items.length))]
      : [],
  );
  const activeDot = $derived(
    items.length ? ((index % items.length) + items.length) % items.length : 0,
  );

  function measure() {
    const el = viewportEl;
    if (!el || el.clientWidth <= 0) return;
    cardPx = (el.clientWidth - GAP_PX * (perView - 1)) / perView;
  }

  function goTo(i: number, withAnim = true) {
    animating = withAnim;
    index = i;
  }

  function next() {
    if (items.length < 2) return;
    goTo(index + 1);
  }

  function prev() {
    if (items.length < 2) return;
    if (index === 0) {
      goTo(items.length, false);
      requestAnimationFrame(() => {
        void viewportEl?.offsetWidth;
        goTo(items.length - 1);
      });
      return;
    }
    goTo(index - 1);
  }

  function onTransitionEnd(e: TransitionEvent) {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (index < items.length) return;
    goTo(index - items.length, false);
  }

  function applyPerView(wide: boolean) {
    const n = wide ? Math.min(maxPerView, Math.max(1, items.length)) : 1;
    if (n !== perView) {
      perView = n;
      index = 0;
      animating = false;
    }
    measure();
  }

  $effect(() => {
    items.length;
    maxPerView;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => applyPerView(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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
    const id = window.setInterval(next, autoplayMs);
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
                  onclick={() => goTo(i)}
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
        class="flex gap-3 will-change-transform {animating
          ? 'transition-transform duration-300 ease-out'
          : ''}"
        style="transform: translate3d(-{index * stepPx}px,0,0)"
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
