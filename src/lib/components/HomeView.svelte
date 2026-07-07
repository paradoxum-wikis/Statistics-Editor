<script lang="ts">
  import TowerPicker from "./TowerPicker.svelte";
  import Supporters from "./smol/Supporters.svelte";
  import SubtleRow from "./smol/SubtleRow.svelte";

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

  const greeting = $derived.by(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning, editor!";
    if (hour >= 12 && hour < 17) return "Good afternoon, editor!";
    if (hour >= 17 && hour < 22) return "Good evening, editor!";
    return "Up late, editor? Welcome!";
  });
</script>

<div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
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

  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
    <TowerPicker variant="home" class="min-h-0 min-w-0 flex-1" {onSelect} />
    <Supporters class="h-full min-h-0 self-stretch" />
  </div>
</div>
