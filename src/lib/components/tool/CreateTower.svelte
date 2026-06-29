<script lang="ts">
  import { Popover } from "bits-ui";
  import { FilePlus } from "@lucide/svelte";
  import IconBtn from "../smol/IconBtn.svelte";
  import TextInput from "../smol/TextInput.svelte";
  import { towerStore } from "$lib/stores/tower.svelte";

  let {
    variant = "icon",
    onCreated,
    side = "top",
    align = "start",
    sideOffset = variant === "menu" ? 8 : 6,
  }: {
    variant?: "icon" | "menu";
    onCreated?: (name: string) => void | Promise<void>;
    side?: "top" | "bottom" | "left" | "right";
    align?: "start" | "center" | "end";
    sideOffset?: number;
  } = $props();

  let open = $state(false);
  let newTowerName = $state("");
  let createError = $state("");

  function reset() {
    newTowerName = "";
    createError = "";
  }

  async function submit() {
    createError = "";
    const created = await towerStore.createTower(newTowerName);
    if (!created) {
      createError = "Name already exists or is invalid.";
      return;
    }
    reset();
    open = false;
    await onCreated?.(created);
  }
</script>

<Popover.Root
  bind:open
  onOpenChange={(isOpen) => {
    if (!isOpen) reset();
  }}
>
  {#if variant === "menu"}
    <Popover.Trigger class="dropdown-item w-full justify-start!">
      <FilePlus class="me-2 h-4 w-4" />
      <span>Create Tower</span>
    </Popover.Trigger>
  {:else}
    <Popover.Trigger>
      {#snippet child({ props })}
        <IconBtn {...props} class="status-bar-btn" title="Create Tower">
          <FilePlus size={16} />
        </IconBtn>
      {/snippet}
    </Popover.Trigger>
  {/if}
  <Popover.Portal>
    <Popover.Content class="popover-content w-64!" {side} {align} {sideOffset}>
      <h4 class="mb-2 text-sm font-medium">Create Tower</h4>
      <form
        class="space-y-2"
        onsubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextInput
          bind:value={newTowerName}
          placeholder="Tower name"
          autofocus
        />
        {#if createError}
          <p class="text-xs text-destructive">{createError}</p>
        {/if}
        <button
          type="submit"
          class="btn btn-primary w-full"
          disabled={!newTowerName.trim()}
        >
          Create
        </button>
      </form>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
