<script lang="ts">
  import { onMount } from "svelte";
  import { loadSupporters, type SupportersData } from "$lib/supporters";
  import Marquee from "./Marquee.svelte";

  let { class: className }: { class?: string } = $props();

  let data = $state<SupportersData | null>(null);

  onMount(() => {
    void loadSupporters().then((result) => {
      data = result;
    });
  });

  function tierKind(tier: string) {
    return /tier\s*ii|\bii\b/i.test(tier) ? "ii" : "i";
  }
</script>

<div
  class={["flex min-h-0 flex-col gap-2 lg:h-full lg:w-72 xl:w-80", className]}
>
  {#if data?.profile}
    <div
      class="shrink-0 rounded-[calc(var(--radius)-0.25rem)_0] border border-border bg-card p-2.5 text-center"
    >
      <a
        href={data.profile.link}
        target="_blank"
        rel="noopener noreferrer"
        class="mx-auto block w-fit"
      >
        <img
          src={data.profile.avatar}
          alt=""
          class="h-14 w-14 rounded-full object-cover"
          loading="lazy"
        />
      </a>
      <p class="mt-1.5 text-sm unisans font-semibold">{data.profile.name}</p>
      <a
        href={data.profile.link}
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-primary btn-sm mt-2 w-full"
      >
        Support Us!
      </a>
    </div>
  {/if}

  <aside
    class="flex min-h-0 flex-1 flex-col rounded-[calc(var(--radius)-0.25rem)_0] border border-border bg-card"
  >
    <div class="border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold unisans">Supporters</h3>
    </div>

    <ul class="min-h-0 flex-1 overflow-y-auto p-2">
      {#if !data}
        <li class="px-1 py-2 text-xs text-muted-foreground">Loading...</li>
      {:else if data.supporters.length === 0}
        <li class="px-1 py-2 text-xs text-muted-foreground">
          No supporters yet.
        </li>
      {:else}
        {#each data.supporters as supporter (`${supporter.name}-${supporter.link}`)}
          <li>
            <a
              href={supporter.link}
              target="_blank"
              rel="noopener noreferrer"
              class="flex gap-2.5 rounded-[calc(var(--radius)-0.5rem)_0] px-1.5 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <img
                src={supporter.avatar}
                alt=""
                class="h-10 w-10 shrink-0 self-center rounded-full object-cover"
                loading="lazy"
              />
              <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div class="flex min-w-0 items-baseline gap-1.5 text-sm">
                  <span class="truncate font-medium">{supporter.name}</span>
                  <span
                    class="tier shrink-0 text-xs font-bold"
                    class:tier-i={tierKind(supporter.tier) === "i"}
                    class:tier-ii={tierKind(supporter.tier) === "ii"}
                    >{supporter.tier}</span
                  >
                </div>
                <Marquee text={supporter.msg} />
              </div>
            </a>
          </li>
        {/each}
      {/if}
    </ul>
  </aside>
</div>

<style>
  .tier-i {
    color: oklch(0.78 0.14 85);
  }

  .tier-ii {
    background-image: linear-gradient(
      147deg,
      oklch(0.58 0.18 280),
      oklch(0.78 0.18 290),
      oklch(0.82 0.01 120),
      oklch(0.58 0.18 260)
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: tier-ii-shift 2.7s linear infinite;
  }

  @keyframes tier-ii-shift {
    to {
      background-position: 200% center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tier-ii {
      animation: none;
      background-position: 0 center;
    }
  }
</style>
