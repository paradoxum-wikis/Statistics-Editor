<script lang="ts">
  import TowerPicker from "./TowerPicker.svelte";
  import Supporters from "./smol/Supporters.svelte";
  import SubtleRow from "./smol/SubtleRow.svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import ghLogo from "$lib/assets/GitHub.svg?raw";
  import aewLogo from "$lib/assets/AEW.svg?raw";
  import tdswLogo from "$lib/assets/TDSW.svg?raw";

  let { onSelect }: { onSelect: (name: string) => void } = $props();

  const steps = [
    {
      title: "Select a Tower",
      text: "Use the search bar or browse the list below, and get started!",
    },
    {
      title: "Edit Stats",
      text: "Modify damage, cooldown, range, and other attributes directly in the table.",
    },
    {
      title: "Manage Profiles",
      text: "Create as many profiles as your heart desires to save different stat configs for each tower.",
    },
    {
      title: "Help the Wiki",
      text: "Export the stats you've edited and contribute them to the TDS Wiki to help keep it updated!",
    },
  ] as const;

  const footerLinks = [
    {
      href: "https://github.com/paradoxum-wikis",
      label: "GitHub",
      icon: ghLogo,
      accent: "oklch(0.578 0.0292 35.72)",
    },
    {
      href: "https://alter-ego.fandom.com",
      label: "ALTER EGO Wiki",
      icon: aewLogo,
      accent: "oklch(0.5915 0.2276 27.11)",
    },
    {
      href: "https://tds.fandom.com",
      label: "Tower Defense Simulator Wiki",
      icon: tdswLogo,
      accent: "var(--link)",
    },
  ] as const;

  const greeting = $derived.by(() => {
    const lovelyPerson = authStore.user?.fandom_username ?? "editor";
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return `Good morning, ${lovelyPerson}!`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${lovelyPerson}!`;
    if (hour >= 17 && hour < 22) return `Good evening, ${lovelyPerson}!`;
    return `Up late, ${lovelyPerson}? Welcome!`;
  });
</script>

<div
  class="flex min-h-full flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden"
>
  <div class="shrink-0 space-y-2">
    <h2 class="unisans text-xl font-bold md:text-2xl">{greeting}</h2>
    <p class="text-xs text-muted-foreground md:text-sm">
      The Statistics Editor is a community made tool for creating and editing
      Tower Defense Simulator tower stats, duh.
    </p>

    <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {#each steps as step, i (step.title)}
        <SubtleRow class="p-2.5">
          <p class="text-sm font-semibold unisans">
            <span class="text-muted-foreground">{i + 1}.</span>
            {step.title}
          </p>
          <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
            {step.text}
          </p>
        </SubtleRow>
      {/each}
    </div>
  </div>

  <div
    class="flex min-h-0 flex-col gap-3 lg:flex-1 lg:flex-row lg:overflow-hidden"
  >
    <TowerPicker
      variant="home"
      class="min-h-0 min-w-0 lg:h-full lg:flex-1"
      {onSelect}
    />
    <Supporters class="min-h-0 max-lg:min-h-72 lg:h-full" />
  </div>
</div>

<footer
  class="mt-8 border-t border-border pt-5 text-center text-sm text-muted-foreground"
>
  <p>
    The TDS Statistics Editor is maintained by Paradoxum Wikis. It is not
    affiliated with Paradoxum Games and is an independent community project.
  </p>

  <ul
    class="mt-3 flex list-none flex-wrap items-center justify-center gap-x-4 gap-y-2 p-0"
  >
    {#each footerLinks as link (link.href)}
      <li>
        <a
          class="inline-flex items-center gap-1.5 font-medium text-(--footer-accent) transition-colors hover:text-[color-mix(in_oklch,var(--footer-accent),black_27%)] hover:underline hover:underline-offset-2"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style:--footer-accent={link.accent}
        >
          <span
            class="size-4.5 shrink-0 [&>svg]:block [&>svg]:size-full"
            aria-hidden="true"
          >
            {@html link.icon}
          </span>
          {link.label}
        </a>
      </li>
    {/each}
  </ul>
</footer>
