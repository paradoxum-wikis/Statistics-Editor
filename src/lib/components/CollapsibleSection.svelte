<script lang="ts">
    import { Collapsible as Col } from "bits-ui";
    import { ChevronDown } from "@lucide/svelte";
    import { slide } from "svelte/transition";
    import Separator from "./Separator.svelte";
    import type { Snippet } from "svelte";
    import type { Icon } from "@lucide/svelte";

    let {
        title,
        icon: IconComponent,
        open = $bindable(false),
        showSeparator = true,
        isPvp = false,
        children,
    }: {
        title: string;
        icon?: typeof Icon;
        open?: boolean;
        showSeparator?: boolean;
        isPvp?: boolean;
        children: Snippet;
    } = $props();
</script>

{#if showSeparator}
    <div class="mt-4">
        <Separator />
    </div>
{/if}

<Col.Root bind:open>
    <Col.Trigger class="section-trigger">
        <span class="section-title">
            {#if IconComponent}
                <IconComponent class="inline w-3.5 h-3.5 mb-0.5 opacity-70" />
            {/if}
            {title}
            {#if isPvp}
                <span class="text-xs font-normal text-muted-foreground ml-1">(PVP)</span>
            {/if}
        </span>
        <ChevronDown class="chevron-icon" style="transform: rotate({open ? '180deg' : '0deg'})" />
    </Col.Trigger>
    <Col.Content forceMount>
        {#snippet child({ open: isOpen })}
            {#if isOpen}
                <div class="pb-2" transition:slide={{ duration: 150 }}>
                    {@render children()}
                </div>
            {/if}
        {/snippet}
    </Col.Content>
</Col.Root>

<style>
    @reference "../../routes/layout.css";
</style>
