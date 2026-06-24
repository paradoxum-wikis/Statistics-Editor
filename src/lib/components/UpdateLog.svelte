<script lang="ts" module>
  type Entry = {
    sha: string;
    date: string;
    badgeType: string | null;
    badgeScope: string | null;
    color: string | null;
    message: string;
    url: string;
  };

  type UpdateLogCache = { entries: Entry[]; failed: boolean };

  const REPO =
    "https://api.github.com/repos/paradoxum-wikis/Statistics-Editor/commits";
  const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;

  const TYPE_LABELS: Record<string, string> = {
    feat: "feature",
    doc: "documentation",
    perf: "performance",
    ci: "continuous integration",
  };

  const TYPE_COLORS: Record<string, string> = {
    feature: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    fix: "bg-red-500/15 text-red-700 dark:text-red-400",
    perf: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    refactor: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    style: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
    documentation: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    chore: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
    performance: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    "continuous integration": "bg-teal-300/15 text-teal-500 dark:text-teal-200",
  };

  let cache: UpdateLogCache | null = null;
  let loadPromise: Promise<UpdateLogCache> | null = null;

  function commitBadge(type: string, scope: string | null) {
    const name = TYPE_LABELS[type] ?? type;
    const badgeType = name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    const color = TYPE_COLORS[name] ?? TYPE_COLORS.chore;
    return { badgeType, badgeScope: scope, color };
  }

  async function loadUpdateLog(): Promise<UpdateLogCache> {
    if (cache) return cache;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const res = await fetch(REPO);
        if (!res.ok) throw new Error();

        const data = (await res.json()) as {
          sha: string;
          html_url: string;
          commit: { message: string; author: { date: string } };
        }[];

        cache = {
          failed: false,
          entries: data.map((item) => {
            const subject = item.commit.message.split("\n")[0] ?? "";
            const match = CONVENTIONAL.exec(subject);
            const badge = match
              ? commitBadge(match[1], match[2] ?? null)
              : { badgeType: null, badgeScope: null, color: null };

            return {
              sha: item.sha.slice(0, 7),
              date: item.commit.author.date,
              badgeType: badge.badgeType,
              badgeScope: badge.badgeScope,
              color: badge.color,
              message: match?.[3] ?? subject,
              url: item.html_url,
            };
          }),
        };
      } catch {
        cache = { entries: [], failed: true };
      }

      return cache;
    })();

    return loadPromise;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import Card from "./smol/Card.svelte";
  import Separator from "./smol/Separator.svelte";

  type DayGroup = { label: string; entries: Entry[] };

  let entries = $state<Entry[]>(cache?.entries ?? []);
  let loading = $state(!cache);
  let failed = $state(cache?.failed ?? false);

  const groups = $derived.by(() => {
    const byDay = new Map<string, Entry[]>();

    for (const entry of entries) {
      const label = new Date(entry.date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const day = byDay.get(label) ?? [];
      day.push(entry);
      byDay.set(label, day);
    }

    return [...byDay.entries()].map(([label, dayEntries]) => ({
      label,
      entries: dayEntries,
    })) satisfies DayGroup[];
  });

  onMount(async () => {
    const result = await loadUpdateLog();
    entries = result.entries;
    failed = result.failed;
    loading = false;
  });
</script>

<Card class="max-w-3xl mx-auto mt-6 p-8">
  <div class="mb-4 flex items-baseline justify-between gap-4">
    <h3 class="unisans text-xl font-bold text-foreground">Recent Updates</h3>
    <a
      href="https://github.com/paradoxum-wikis/Statistics-Editor/commits/main/"
      target="_blank"
      rel="noopener noreferrer"
      class="text-sm text-link hover:underline"
    >
      View all
    </a>
  </div>

  {#if loading}
    <p class="text-sm text-muted-foreground animate-pulse">
      Loading updates...
    </p>
  {:else if failed}
    <p class="text-sm text-muted-foreground">
      Couldn't load updates.
      <a
        href="https://github.com/paradoxum-wikis/Statistics-Editor/commits/main/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-link hover:underline"
      >
        View on GitHub
      </a>
    </p>
  {:else}
    <div class="max-h-80 space-y-5 overflow-y-auto pr-1">
      {#each groups as group, i (group.label)}
        <section class="space-y-2">
          <h4
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {group.label}
          </h4>
          <ul class="space-y-1.5">
            {#each group.entries as entry (entry.sha)}
              <li class="flex items-start gap-2 text-sm">
                {#if entry.badgeType}
                  <span
                    class="rounded px-1.5 py-0.5 text-xs font-medium {entry.color}"
                  >
                    {entry.badgeType}{#if entry.badgeScope}
                      <span class="text-[0.65rem] font-normal opacity-75">
                        &MediumSpace;({entry.badgeScope})
                      </span>
                    {/if}
                  </span>
                {/if}
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="min-w-0 text-foreground hover:text-link hover:underline"
                >
                  {entry.message}
                </a>
              </li>
            {/each}
          </ul>
        </section>
        {#if i < groups.length - 1}
          <Separator />
        {/if}
      {/each}
    </div>
  {/if}
</Card>
