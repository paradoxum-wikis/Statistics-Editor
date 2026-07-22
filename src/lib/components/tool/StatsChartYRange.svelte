<script lang="ts">
  import { Slider } from "bits-ui";
  import { formatChartNumber, yRangeStep } from "$lib/utils/statsChart";

  let {
    min,
    max,
    onDomain,
  }: {
    min: number;
    max: number;
    onDomain?: (domain: [number, number] | null) => void;
  } = $props();

  let custom = $state(false);
  let userThumbs = $state<[number, number] | null>(null);

  const step = $derived(yRangeStep([min, max]));
  const gap = $derived(Math.min(step, Math.max(0, max - min)));

  const thumbs = $derived.by((): [number, number] => {
    if (!custom || !userThumbs) return [min, max];
    const a = Math.min(userThumbs[0], userThumbs[1]);
    const b = Math.max(userThumbs[0], userThumbs[1]);
    const lo = Math.max(min, a);
    const hi = Math.min(max, b);
    return hi > lo ? [lo, hi] : [min, max];
  });

  function separate(next: number[]): [number, number] {
    let lo = Math.min(next[0], next[1]);
    let hi = Math.max(next[0], next[1]);
    if (gap <= 0 || hi - lo >= gap) {
      return [Math.max(min, lo), Math.min(max, hi)];
    }

    const prevLo = thumbs[0];
    const prevHi = thumbs[1];
    const lowMoved = Math.abs(lo - prevLo) >= Math.abs(hi - prevHi);

    if (lowMoved) {
      lo = hi - gap;
      if (lo < min) {
        lo = min;
        hi = Math.min(max, lo + gap);
      }
    } else {
      hi = lo + gap;
      if (hi > max) {
        hi = max;
        lo = Math.max(min, hi - gap);
      }
    }
    return [lo, hi];
  }

  function onChange(v: number[]) {
    if (v.length < 2) return;
    const [a, b] = separate(v);
    if (a === thumbs[0] && b === thumbs[1]) return;
    const atAuto = a === min && b === max;
    custom = !atAuto;
    userThumbs = atAuto ? null : [a, b];
    onDomain?.(atAuto ? null : [a, b]);
  }

  function reset() {
    custom = false;
    userThumbs = null;
    onDomain?.(null);
  }
</script>

<div class="space-y-1.5">
  <div class="flex items-center justify-between gap-2 text-xs">
    <span class="text-muted-foreground">Y range</span>
    <div class="flex items-center gap-2">
      <span class="font-mono tabular-nums text-muted-foreground">
        {formatChartNumber(thumbs[0])} – {formatChartNumber(thumbs[1])}
      </span>
      {#if custom}
        <button
          type="button"
          class="text-xs text-link hover:underline"
          onclick={reset}
        >
          Reset
        </button>
      {/if}
    </div>
  </div>
  <Slider.Root
    type="multiple"
    {min}
    {max}
    {step}
    value={thumbs}
    onValueChange={onChange}
    class="relative flex w-full touch-none select-none items-center py-1"
  >
    {#snippet children({ thumbItems })}
      <span
        class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <Slider.Range class="absolute h-full bg-primary/70" />
      </span>
      {#each thumbItems as { index } (index)}
        <Slider.Thumb
          {index}
          class="block size-3.5 cursor-pointer rounded-full border border-border bg-background shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring data-active:scale-95"
        />
      {/each}
    {/snippet}
  </Slider.Root>
</div>
