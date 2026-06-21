<script lang="ts">
  import Card from "./smol/Card.svelte";
  import SubtleRow from "./smol/SubtleRow.svelte";
  import Separator from "./smol/Separator.svelte";
</script>

<Card class="max-w-3xl mx-auto space-y-6 p-8">
  <div class="space-y-2">
    <h2 class="unisans text-3xl text-foreground font-bold">
      Welcome to the TDS Statistics Editor!
    </h2>
    <p class="text-muted-foreground text-lg">
      A community made tool for creating and editing Tower Defense Simulator
      tower stats, duh.
    </p>
  </div>

  <div class="space-y-4">
    <div class="grid gap-4 md:grid-cols-2">
      <SubtleRow class="p-4">
        <h4 class="font-medium text-foreground mb-2">1. Select a Tower</h4>
        <p class="text-sm text-muted-foreground">
          Use the search bar in the top right corner to find and load any tower
          from the game.
        </p>
      </SubtleRow>

      <SubtleRow class="p-4">
        <h4 class="font-medium text-foreground mb-2">2. Edit Stats</h4>
        <p class="text-sm text-muted-foreground">
          Modify damage, cooldown, range, and other attributes directly in the
          table. Changes are applied instantly.
        </p>
      </SubtleRow>

      <SubtleRow class="p-4">
        <h4 class="font-medium text-foreground mb-2">3. Manage Profiles</h4>
        <p class="text-sm text-muted-foreground">
          Create as many profiles as your heart desires to save different stat
          configurations for each tower.
        </p>
      </SubtleRow>

      <SubtleRow class="p-4">
        <h4 class="font-medium text-foreground mb-2">4. Help The Wiki</h4>
        <p class="text-sm text-muted-foreground">
          Export the stats you've edited and contribute them to the TDS Wiki to
          help keep it up to date!
        </p>
      </SubtleRow>
    </div>
  </div>

  <Separator />

  <p class="text-sm text-muted-foreground text-center">
    Select a tower and get started!
  </p>
</Card>
