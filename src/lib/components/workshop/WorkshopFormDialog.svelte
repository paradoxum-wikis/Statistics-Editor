<script lang="ts">
  import { Dialog } from "bits-ui";
  import { X } from "@lucide/svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import {
    fetchShare,
    parseShareRef,
    sharePageUrl,
  } from "$lib/services/shareTower";
  import {
    createWorkshopListing,
    updateWorkshopListing,
    WORKSHOP_TAGS,
    type WorkshopListing,
    type WorkshopTag,
  } from "$lib/services/workshop";
  import { analytics } from "$lib/services/analytics";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { toast } from "$lib/toast";
  import TextInput from "../smol/TextInput.svelte";
  import Btn from "../smol/Btn.svelte";

  function categoryFromTags(tags: string[]): WorkshopTag | "" {
    for (const t of WORKSHOP_TAGS) {
      if (tags.includes(t)) return t;
    }
    return "";
  }

  let {
    mode,
    open = $bindable(false),
    shareId,
    towerName,
    listing,
    onSaved,
  }: {
    mode: "create" | "edit";
    open?: boolean;
    shareId?: string;
    towerName?: string;
    listing?: WorkshopListing;
    onSaved?: () => void;
  } = $props();

  let title = $state("");
  let description = $state("");
  let tag = $state<WorkshopTag | "">("");
  let image = $state("");
  let shareInput = $state("");
  let verified = $state<{ id: string; tower_name: string } | null>(null);
  let checking = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!open) return;
    error = null;
    busy = false;
    checking = false;
    shareInput = "";
    if (mode === "edit" && listing) {
      title = listing.title;
      description = listing.description;
      tag = categoryFromTags(listing.tags);
      image = listing.image ?? "";
      verified = { id: listing.share_id, tower_name: listing.tower_name };
    } else {
      title = towerName ?? "";
      description = "";
      tag = "";
      image = "";
      verified =
        shareId && towerName ? { id: shareId, tower_name: towerName } : null;
    }
  });

  const shareDirty = $derived(
    shareInput.trim() !== "" && parseShareRef(shareInput) !== verified?.id,
  );
  const canSubmit = $derived(
    !!authStore.user &&
      !!verified &&
      title.trim().length > 0 &&
      title.trim().length <= 80 &&
      description.trim().length <= 500 &&
      image.trim().length <= 512 &&
      !shareDirty &&
      !busy &&
      !checking,
  );

  function selectTag(next: WorkshopTag) {
    tag = tag === next ? "" : next;
  }

  async function checkShare() {
    if (checking || !shareDirty) return;
    checking = true;
    error = null;
    try {
      const share = await fetchShare(shareInput);
      if (!share.tower_name?.trim())
        throw new Error("Share has no tower name.");
      verified = { id: share.id, tower_name: share.tower_name };
      shareInput = "";
      if (!title.trim()) title = share.tower_name;
    } catch (e) {
      if (settingsStore.debugMode) console.error("[workshop] check share", e);
      error = e instanceof Error ? e.message : "Couldn't load that share.";
    } finally {
      checking = false;
    }
  }

  async function submit() {
    if (!canSubmit || !verified) return;
    busy = true;
    error = null;
    try {
      if (mode === "edit" && listing) {
        await updateWorkshopListing(listing.id, {
          title: title.trim(),
          description: description.trim(),
          tags: tag ? [tag] : [],
          image: image.trim(),
          ...(verified.id !== listing.share_id
            ? { share_id: verified.id }
            : {}),
        });
        toast.success("Listing updated!");
      } else {
        await createWorkshopListing({
          share_id: verified.id,
          title: title.trim(),
          description: description.trim(),
          tags: tag ? [tag] : [],
          image: image.trim(),
        });
        toast.success("Published to the Workshop!");
        analytics.track("workshop_publish", {
          tower_name: verified.tower_name,
          success: true,
        });
      }
      onSaved?.();
      open = false;
    } catch (e) {
      if (settingsStore.debugMode) console.error("[workshop] publish", e);
      error = e instanceof Error ? e.message : "Something went wrong.";
      if (mode === "create") {
        analytics.track("workshop_publish", {
          tower_name: verified.tower_name,
          success: false,
        });
      }
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content max-h-[90vh] overflow-y-auto">
      <Dialog.Title class="dialog-title">
        {mode === "edit" ? "Edit Listing" : "Publish to Workshop"}
      </Dialog.Title>
      <Dialog.Description class="dialog-description">
        {mode === "edit"
          ? "Update card metadata, or point it at a newer share."
          : "The share is what people open; the card is how they find it."}
      </Dialog.Description>

      {#if !authStore.user}
        <p class="text-sm text-muted-foreground">
          Sign in with Fandom first, you can find the login prompt in the top
          bar as an avatar icon.
        </p>
      {:else}
        <div class="space-y-3">
          {#if verified}
            <div class="space-y-1">
              <span class="text-sm font-medium">Share Link</span>
              <div
                class="flex items-center justify-between gap-2 rounded-[var(--radius)_0] border border-border bg-muted/50 px-3 py-2 text-sm"
              >
                <span class="truncate font-medium">{verified.tower_name}</span>
                <span class="shrink-0 font-mono text-xs text-muted-foreground">
                  {sharePageUrl(verified.id)}
                </span>
              </div>
            </div>
          {/if}

          {#if !verified || mode === "edit"}
            <div class="space-y-1">
              <label class="text-sm font-medium" for="workshop-share-input">
                {#if mode === "edit"}
                  Replace Share Link
                  <span class="font-normal text-muted-foreground"
                    >(optional)</span
                  >
                {:else}
                  Share link
                {/if}
              </label>
              <div class="flex gap-2">
                <TextInput
                  id="workshop-share-input"
                  class="input-short"
                  placeholder="https://tds.wiki/s/..."
                  bind:value={shareInput}
                  onkeydown={(e: KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void checkShare();
                    }
                  }}
                />
                <Btn
                  variant="outline"
                  size="sm"
                  disabled={!shareDirty || checking}
                  onclick={checkShare}
                >
                  {checking ? "Checking..." : "Check"}
                </Btn>
              </div>
            </div>
          {/if}

          <div class="space-y-1">
            <div class="flex items-baseline justify-between">
              <label class="text-sm font-medium" for="workshop-title-input"
                >Title</label
              >
              <span class="text-xs text-muted-foreground"
                >{title.trim().length}/80</span
              >
            </div>
            <TextInput
              id="workshop-title-input"
              class="input-short"
              placeholder="Accel rework but actually balanced"
              maxlength="80"
              bind:value={title}
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-baseline justify-between">
              <label class="text-sm font-medium" for="workshop-desc-input"
                >Description</label
              >
              <span class="text-xs text-muted-foreground"
                >{description.trim().length}/500</span
              >
            </div>
            <textarea
              id="workshop-desc-input"
              class="input h-auto min-h-20 resize-none py-2"
              placeholder="Tell everyone about your delightful creation!"
              maxlength="500"
              rows="3"
              bind:value={description}></textarea>
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium" for="workshop-image-input"
              >Image <span class="font-normal text-muted-foreground"
                >(optional)</span
              ></label
            >
            <TextInput
              id="workshop-image-input"
              class="input-short"
              placeholder="File:Place.png · Roblox Asset ID · https://..."
              maxlength="512"
              bind:value={image}
            />
            <p class="text-xs text-muted-foreground">
              Same formats as upgrade images: wiki File:/Image:, Roblox id, or
              direct URL.
            </p>
          </div>

          <div class="space-y-1">
            <span class="text-sm font-medium">Tag</span>
            <div class="flex flex-wrap gap-1.5">
              {#each WORKSHOP_TAGS as t (t)}
                {@const active = tag === t}
                <button
                  type="button"
                  class="rounded-full border px-3 py-0.5 text-xs capitalize transition-colors {active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'}"
                  aria-pressed={active}
                  onclick={() => selectTag(t)}
                >
                  {t}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      <div class="flex justify-end gap-2">
        <Dialog.Close class="btn btn-outline">Cancel</Dialog.Close>
        {#if authStore.user}
          <Btn variant="primary" disabled={!canSubmit} onclick={submit}>
            {busy
              ? mode === "edit"
                ? "Saving..."
                : "Publishing..."
              : mode === "edit"
                ? "Save changes"
                : "Publish"}
          </Btn>
        {/if}
      </div>

      <Dialog.Close class="icon-btn absolute right-3 top-3" aria-label="Close">
        <X size={16} />
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
