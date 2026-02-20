<script lang="ts">
    import Separator from "./smol/Separator.svelte";
</script>

<div class="intro-container">
    <div class="intro-header">
        <h2 class="intro-title">
            Welcome to the TDS Statistics Editor!
        </h2>
        <p class="intro-subtitle">
            A community made tool for creating and editing Tower Defense
            Simulator tower stats, duh.
        </p>
    </div>

    <div class="intro-grid-container">
        <div class="intro-grid">
            <div class="intro-card">
                <h4 class="intro-card-title">1. Select a Tower</h4>
                <p class="intro-card-text">
                    Use the search bar in the top right corner to find and load
                    any tower from the game.
                </p>
            </div>

            <div class="intro-card">
                <h4 class="intro-card-title">2. Edit Stats</h4>
                <p class="intro-card-text">
                    Modify damage, cooldown, range, and other attributes
                    directly in the table. Changes are applied instantly.
                </p>
            </div>

            <div class="intro-card">
                <h4 class="intro-card-title">
                    3. Manage Profiles
                </h4>
                <p class="intro-card-text">
                    Create as many profiles as your heart desires to save
                    different stat configurations for each tower.
                </p>
            </div>

            <div class="intro-card">
                <h4 class="intro-card-title">4. Help The Wiki</h4>
                <p class="intro-card-text">
                    Export the stats you've edited and contribute them to the
                    TDS Wiki to help keep it up to date!
                </p>
            </div>
        </div>
    </div>

    <Separator />

    <div class="pt-4">
        <p class="intro-footer-text">
            Select a tower and get started!
        </p>
    </div>
</div>

<style>
    @reference "../../routes/layout.css";

    .intro-container {
        border-radius: var(--radius) 0;
        @apply border bg-card shadow p-8 max-w-3xl mx-auto space-y-6;
    }

    .intro-header {
        @apply space-y-2;
    }

    .intro-title {
        @apply text-3xl font-bold text-foreground;
    }

    .intro-subtitle {
        @apply text-muted-foreground text-lg;
    }

    .intro-grid-container {
        @apply space-y-4;
    }

    .intro-grid {
        @apply grid gap-4 md:grid-cols-2;
    }

    .intro-card {
        border-radius: var(--radius) 0;
        @apply p-4 border border-border bg-secondary/10;
    }

    .intro-card-title {
        @apply font-medium text-foreground mb-2;
    }

    .intro-card-text {
        @apply text-sm text-muted-foreground;
    }

    .intro-footer-text {
        @apply text-sm text-muted-foreground text-center;
    }
</style>
