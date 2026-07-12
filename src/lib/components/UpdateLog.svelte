<script lang="ts" module>
  type Entry = {
    sha: string;
    date: string;
    author: string;
    authorUrl: string;
    badgeType: string | null;
    badgeScope: string | null;
    color: string | null;
    breaking: boolean;
    message: string;
    url: string;
  };

  type UpdateLogCache = { entries: Entry[]; failed: boolean };

  const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

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

  function badgeTip(entry: Entry) {
    const type = entry.breaking
      ? `${entry.badgeType} [Breaking Change]`
      : entry.badgeType!;
    return entry.badgeScope ? `${type} (${entry.badgeScope})` : type;
  }

  async function loadUpdateLog(): Promise<UpdateLogCache> {
    if (cache) return cache;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const res = await fetch(
          "https://api.github.com/repos/paradoxum-wikis/Statistics-Editor/commits",
        );
        if (!res.ok) throw new Error();

        const data = (await res.json()) as {
          sha: string;
          html_url: string;
          author: { login: string; html_url: string };
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
              author: item.author.login,
              authorUrl: item.author.html_url,
              badgeType: badge.badgeType,
              badgeScope: badge.badgeScope,
              color: badge.color,
              breaking: match?.[3] === "!",
              message: match?.[4] ?? subject,
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
  import Tip from "./smol/Tip.svelte";

  type DayGroup = { label: string; entries: Entry[] };

  let entries = $state<Entry[]>(cache?.entries ?? []);
  let loading = $state(!cache);
  let failed = $state(cache?.failed ?? false);

  const groups = $derived.by(() => {
    const byDay = new Map<string, Entry[]>();

    for (const entry of entries) {
      const label = new Date(entry.date).toLocaleDateString(undefined, {
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

  function entryTime(date: string) {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  onMount(async () => {
    const result = await loadUpdateLog();
    entries = result.entries;
    failed = result.failed;
    loading = false;
  });
</script>

{#if loading}
  <p class="animate-pulse text-center text-xs text-muted-foreground">
    Scout is on the lookout for updates...
  </p>
{:else if failed}
  <p class="text-xs text-muted-foreground">
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
  <div class="min-w-0 space-y-4">
    {#each groups as group (group.label)}
      <section class="min-w-0 space-y-2">
        <h4
          class="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {group.label}
        </h4>
        <ul class="min-w-0 space-y-2">
          {#each group.entries as entry (entry.sha)}
            <li
              class="min-w-0 rounded-[calc(var(--radius)-0.5rem)_0] border border-border/60 p-2 bg-muted"
            >
              <div class="mb-1 flex min-w-0 items-start justify-between gap-2">
                {#if entry.badgeType}
                  <Tip content={badgeTip(entry)}>
                    {#snippet children({ props })}
                      <span
                        class="min-w-0 truncate rounded px-1.5 py-0.5 text-[0.65rem] font-medium leading-tight {entry.color}"
                        {...props}
                      >
                        {entry.badgeType}{#if entry.breaking}!{/if}{#if entry.badgeScope}
                          <span class="font-normal opacity-75">
                            ({entry.badgeScope})
                          </span>
                        {/if}
                      </span>
                    {/snippet}
                  </Tip>
                {/if}
                <time
                  datetime={entry.date}
                  class="shrink-0 text-[0.65rem] tabular-nums text-muted-foreground"
                >
                  {entryTime(entry.date)}
                </time>
              </div>
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                class="block text-sm leading-snug text-foreground hover:text-link hover:underline"
              >
                {entry.message}
              </a>
              <p class="mt-1 truncate text-[0.65rem] text-muted-foreground">
                <a
                  href={entry.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-link hover:underline"
                >
                  {entry.author}
                </a>
                <span class="text-muted-foreground/70"> · {entry.sha}</span>
              </p>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}
