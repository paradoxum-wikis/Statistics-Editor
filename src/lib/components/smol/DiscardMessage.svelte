<script lang="ts" module>
  export type PendingDiscardAction =
    | { type: "switch-profile"; profile: string }
    | { type: "create-profile"; name: string }
    | { type: "switch-tower"; tower: string }
    | { type: "go-home" };
</script>

<script lang="ts">
  let {
    action,
    towerName,
    profileName,
  }: {
    action: PendingDiscardAction;
    towerName: string;
    profileName: string;
  } = $props();
</script>

You have unsaved changes {#if towerName}
  to <span class="font-bold">{towerName}</span>{/if}
on <span class="font-bold">{profileName}</span>.
{#if action.type === "create-profile"}
  Creating <span class="font-bold">{action.name}</span> will discard them.
{:else if action.type === "switch-profile"}
  Switching to <span class="font-bold">{action.profile}</span>
  will discard them.
{:else if action.type === "switch-tower"}
  Switching to <span class="font-bold">{action.tower}</span>
  will discard them.
{:else}
  Leaving this tower will discard them.
{/if}
