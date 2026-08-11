<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { Tabs } from "bits-ui";
  import Modal from "$lib/components/smol/Modal.svelte";
  import {
    settingsStore,
    settingGroupsForTab,
    type BooleanSetting,
    type SettingTab,
  } from "$lib/stores/settings.svelte";
  import { tabPill } from "$lib/utils/tabPill.svelte";

  const SETTING_TABS: { value: SettingTab; label: string }[] = [
    { value: "editor", label: "Editor" },
    { value: "appearance", label: "Appearance" },
    { value: "advanced", label: "Advanced" },
  ];

  let { open = $bindable(false) } = $props();
  let tab = $state<SettingTab>("editor");
  let tabDirection = $state(1);
</script>

{#snippet settingRow(setting: BooleanSetting, parentActive = true)}
  {@const enabled = settingsStore.getBoolean(setting.key)}
  <div class="setting" class:disabled={!parentActive}>
    <div class="setting-icon">
      <setting.icon size={22} strokeWidth={2.5} />
    </div>
    <div class="setting-text">
      <div class="setting-title">{setting.label}</div>
      <div class="setting-desc">{setting.description}</div>
    </div>
    <button
      id={setting.id}
      class="toggle"
      role="switch"
      aria-checked={enabled}
      aria-label={setting.label}
      disabled={!parentActive}
      onclick={() => settingsStore.setBoolean(setting.key, !enabled)}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        {#if enabled}
          <path
            d="M4 12l6 6L20 6"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {:else}
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
          />
        {/if}
      </svg>
      <span>{enabled ? "Enabled" : "Disabled"}</span>
    </button>
  </div>
{/snippet}

<Tabs.Root
  value={tab}
  onValueChange={(value) => {
    const was = SETTING_TABS.findIndex((item) => item.value === tab);
    const is = SETTING_TABS.findIndex((item) => item.value === value);
    tabDirection = is >= was ? 1 : -1;
    tab = value as SettingTab;
  }}
>
  <Modal
    bind:open
    title="Settings"
    class="sm:max-w-240! md:gap-0! md:p-5! max-md:pb-0"
  >
    {#snippet header()}
      <div class="set-head">
        <div class="tabs-list" use:tabPill={() => tab}>
          <Tabs.List class="contents" aria-label="Settings categories">
            {#each SETTING_TABS as item (item.value)}
              <Tabs.Trigger value={item.value} class="tabs-trigger">
                {item.label}
              </Tabs.Trigger>
            {/each}
          </Tabs.List>
        </div>
        <button
          class="close"
          aria-label="Close settings"
          onclick={() => (open = false)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="4"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    {/snippet}

    <Tabs.Content value={tab}>
      {#key tab}
        <div in:fly={{ x: tabDirection * 48, duration: 180, easing: cubicOut }}>
          <div class="set-grid">
            {#each settingGroupsForTab(tab) as group (group.parent.key)}
              {@render settingRow(group.parent)}
              {#each group.children as child (child.key)}
                {@render settingRow(
                  child,
                  settingsStore.getBoolean(group.parent.key),
                )}
              {/each}
            {/each}
          </div>
        </div>
      {/key}
    </Tabs.Content>
  </Modal>
</Tabs.Root>

<style>
  .set-head {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    width: 100%;
    align-items: center;
    margin-bottom: 1rem;

    .tabs-list {
      grid-column: 2;
      justify-self: center;
    }

    .close {
      grid-column: 3;
      justify-self: end;
    }

    @media (max-width: 767px) {
      display: flex;
      align-items: stretch;

      .tabs-list {
        width: 100%;
        grid-column: auto;
        justify-self: auto;
      }

      :global(.tabs-trigger) {
        flex: 1 1 0%;
        min-width: 0;
        padding-inline: 0.5rem;
      }
    }
  }

  .set-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
    }
  }

  .setting {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--muted);
    transition: opacity 0.15s;

    &.disabled {
      opacity: 0.5;
    }

    .setting-icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      color: var(--primary);
    }

    .setting-title {
      font-size: 15px;
      font-weight: 700;
      -webkit-text-stroke: 0;

      :global(.dark) & {
        -webkit-text-stroke: var(--text-stroke-width) var(--text-stroke-color);
        paint-order: stroke fill;
      }
    }

    .setting-desc {
      margin-top: 1px;
      font-size: 12px;
      color: var(--muted-foreground);
    }

    @media (max-width: 767px) {
      grid-template-columns: 32px 1fr auto;
      gap: 8px;
      padding-inline: 10px;

      .setting-icon {
        width: 28px;
      }
    }
  }

  .toggle {
    --btn: var(--destructive);
    --btn-deep: var(--destructive-dark);
    --btn-rim: oklch(from var(--btn) min(0.95, calc(l + 0.12)) c h);
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 84px;
    border: 2px solid var(--btn-rim);
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--btn) 0%, var(--btn-deep) 100%);
    box-shadow: none;
    padding: 8px 14px;
    color: white;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition:
      filter 0.08s,
      transform 0.05s,
      box-shadow 0.05s;

    &:hover:not(:disabled) {
      filter: brightness(1.06);
    }

    &:active:not(:disabled) {
      transform: translateY(1px);
      box-shadow: none;
    }

    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    &[aria-checked="true"] {
      --btn: var(--green);
      --btn-deep: var(--green-dark);
    }

    &:disabled {
      cursor: not-allowed;
    }

    @media (max-width: 767px) {
      min-width: 68px;
      padding-inline: 8px;
    }
  }
</style>
