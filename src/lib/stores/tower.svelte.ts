import { goto } from "$app/navigation";
import { page } from "$app/state";
import TowerManager from "$lib/towerComponents/towerManager";
import type Tower from "$lib/towerComponents/tower";
import { settingsStore } from "$lib/stores/settings.svelte";
import type { GlobalModifier } from "$lib/utils/globalModifier";
import { columnKeysEqual } from "$lib/utils/format";
import { parseNumeric } from "$lib/utils/format";
import {
  addCustomTower,
  guaraCustomTower,
  isCustomTower,
} from "$lib/towerComponents/customTowers";
import { mergeBaselineOnTowerDiff } from "$lib/utils/towah";
import { embedSeDiff, stripSeDiff } from "$lib/neowtext/directives";
import { fetchShare, parseShareRef } from "$lib/services/shareTower";

/**
 * Manages tower selection and data reactively.
 */
class TowerStore {
  manager = $state<TowerManager | undefined>(undefined);
  names = $state<string[]>([]);
  selectedName = $state("");
  selectedData = $state<Tower | null>(null);
  isLoading = $state(false);
  isDirty = $state(false);
  #lastLoadedName = $state<string | null>(null);

  selectedSkinName = $state<string>("Regular");

  baseline = $state.raw<Record<string, unknown>>({});
  baselineTowerId = $state<string | null>(null);
  baselineSkinName = $state<string | null>(null);
  baselineLocked = $state(false);

  /**
   * Canonical source of truth for what the UI should be editing/viewing.
   *
   * - This is the effective wikitext used to build `selectedData`
   *   (either the base file or a profile override).
   * - Wiki mode should bind to this, and after saving,
   *	 we can reload or parse it back into `selectedData`.
   */
  refreshTrigger = $state(0);
  effectiveWikitext = $state<string>("");
  #wikitextStale = false;

  /**
   * Where the effective wikitext came from.
   */
  effectiveWikitextSource = $state<"override" | "base" | "share" | "">("");

  sharePreviewId = $state<string | null>(null);
  #shareSnapshotWikitext = "";

  /**
   * Original wikitext before any unsaved changes.
   */
  originalWikitext = $state<string>("");

  globalModifier = $state<GlobalModifier>({
    entries: [],
  });

  /**
   * Sets up the tower manager with a profile and loads tower names.
   */
  async init(profile: string): Promise<void> {
    this.manager = new TowerManager(profile, () => settingsStore.debugMode);
    this.names = await this.manager.getTowerNames();
  }

  /**
   * Switches to a new profile, clearing state and reloading if a tower was selected.
   */
  async switchProfile(profile: string): Promise<void> {
    this.manager = new TowerManager(profile, () => settingsStore.debugMode);
    this.#lastLoadedName = null;
    this.selectedData = null;
    this.selectedSkinName = "Regular";
    this.effectiveWikitext = "";
    this.effectiveWikitextSource = "";
    this.originalWikitext = "";
    this.isDirty = false;
    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;
    this.#wikitextStale = false;
    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;
    this.baselineLocked = false;
    this.sharePreviewId = null;
    this.#shareSnapshotWikitext = "";
    const previousSelection = this.selectedName;
    this.selectedName = "";
    this.isLoading = true;
    try {
      if (previousSelection) {
        await this.load(previousSelection);
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Loads a tower by name, skipping if already loaded.
   */
  async load(name: string): Promise<boolean> {
    if (!this.manager || !name) {
      this.selectedData = null;
      this.effectiveWikitext = "";
      this.effectiveWikitextSource = "";
      this.originalWikitext = "";
      this.isDirty = false;
      this.#wikitextStale = false;
      this.sharePreviewId = null;
      this.#shareSnapshotWikitext = "";
      this.baseline = {};
      this.baselineTowerId = null;
      this.baselineSkinName = null;
      return false;
    }

    if (this.sharePreviewId) {
      this.sharePreviewId = null;
      this.#shareSnapshotWikitext = "";
    }

    if (name === this.#lastLoadedName) {
      return true;
    }

    if (settingsStore.debugMode) console.log(`Starting to load tower: ${name}`);
    if (settingsStore.debugMode) console.time(`Load tower ${name}`);
    this.isLoading = true;
    this.selectedData = null;

    try {
      const tower = await this.manager.getTower(name);
      if (tower) {
        this.selectedData = tower;
        this.selectedName = name;
        this.#lastLoadedName = name;

        const skins = tower.skinNames;
        if (!skins.includes(this.selectedSkinName)) {
          this.selectedSkinName = skins.includes("Regular")
            ? "Regular"
            : skins[0] || "";
        }

        const anyTower = tower as unknown as {
          sourceWikitext?: string;
          wikitextSource?: "override" | "base";
        };
        this.effectiveWikitext = anyTower.sourceWikitext ?? "";
        this.effectiveWikitextSource = anyTower.wikitextSource ?? "";
        this.originalWikitext = this.effectiveWikitext;
        this.isDirty = false;
        this.#wikitextStale = false;

        const savedDiff = (
          tower as unknown as { diffBaseline?: Record<string, unknown> }
        ).diffBaseline;
        if (savedDiff && Object.keys(savedDiff).length > 0) {
          this.baseline = savedDiff;
          this.baselineTowerId = name;
          this.baselineSkinName = null;
          this.baselineLocked = true;
          if (settingsStore.debugMode)
            console.log(
              `[TowerStore] Loaded @se-diff baseline (${Object.keys(savedDiff).length} cells)`,
            );
        } else {
          this.baseline = {};
          this.baselineTowerId = null;
          this.baselineSkinName = null;
          this.baselineLocked = false;
        }

        if (settingsStore.debugMode)
          console.log(`Loaded tower data for ${name}`);
        return true;
      } else {
        console.error(`Failed to load tower: ${name}`);
        this.selectedData = null;
        this.effectiveWikitext = "";
        this.effectiveWikitextSource = "";
        this.originalWikitext = "";
        this.isDirty = false;
        this.#wikitextStale = false;
        this.baseline = {};
        this.baselineTowerId = null;
        this.baselineSkinName = null;
        return false;
      }
    } finally {
      if (settingsStore.debugMode) console.timeEnd(`Load tower ${name}`);
      this.isLoading = false;
    }
  }

  async loadFirst(): Promise<boolean> {
    if (this.names.length > 0) {
      this.selectedName = this.names[0];
      return await this.load(this.names[0]);
    }
    return false;
  }

  /**
   * Updates the effective wikitext based on current object state (unsaved).
   */
  refresh(): void {
    this.refreshTrigger++;
  }

  markDirty(): void {
    this.isDirty = true;
    this.#wikitextStale = true;
    this.refresh();
  }

  guaraWikitextSynced(): void {
    if (!this.#wikitextStale) return;
    if (!this.manager || !this.selectedData) return;
    const generated = this.manager.generateWikitext(this.selectedData);
    if (generated) {
      this.effectiveWikitext = generated;
      this.#wikitextStale = false;
    }
  }

  updateSourceWikitext(doc: string): void {
    this.effectiveWikitext = doc;
    this.isDirty = doc !== this.originalWikitext;
    this.#wikitextStale = false;
  }

  async applyWikiWikitext(): Promise<void> {
    if (!this.manager || !this.selectedData || !this.isDirty) return;
    const text = this.effectiveWikitext;
    if (!text.trim()) return;
    if (
      (this.selectedData as { sourceWikitext?: string }).sourceWikitext === text
    ) {
      return;
    }

    const old = this.selectedData;
    const next = await this.manager.getTower(this.selectedName, {
      wikitext: text,
      ephemeral: true,
    });
    if (!next) return;

    this.baseline = mergeBaselineOnTowerDiff(old, next, this.baseline);
    Object.assign(next, {
      sourceWikitext: text,
      wikitextSource: this.effectiveWikitextSource || "override",
    });
    this.selectedData = next;
    this.refresh();
  }

  captureBaselineCell(key: string, value: unknown): void {
    if (key in this.baseline) return;
    this.baseline = { ...this.baseline, [key]: value };
  }

  /**
   * Persists changes to storage.
   * @param diffBaseline Changed-cell baseline snapshot for @se-diff (empty removes block).
   */
  buildShareNeowtext(
    diffBaseline: Record<string, unknown> = {},
  ): string | null {
    if (!this.manager || !this.selectedData) return null;
    this.guaraWikitextSynced();
    if (!this.effectiveWikitext) return null;
    return embedSeDiff(this.effectiveWikitext, diffBaseline);
  }

  async importFromShare(shareRef: string): Promise<boolean> {
    if (!this.manager) return false;

    const share = await fetchShare(shareRef);
    const towerName = share.tower_name?.trim();
    if (!towerName) {
      throw new Error("This share link has no tower name.");
    }

    const shareId = parseShareRef(shareRef) ?? share.id;
    this.isLoading = true;
    this.selectedData = null;
    this.sharePreviewId = null;
    this.#shareSnapshotWikitext = "";
    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;

    try {
      const tower = await this.manager.getTower(towerName, {
        wikitext: share.neowtext,
        ephemeral: true,
      });
      if (!tower) return false;

      this.selectedData = tower;
      this.selectedName = towerName;
      this.#lastLoadedName = `share:${towerName}:${shareId}`;
      this.#shareSnapshotWikitext = share.neowtext;
      this.sharePreviewId = shareId;

      const anyTower = tower as unknown as {
        sourceWikitext?: string;
        diffBaseline?: Record<string, unknown>;
      };
      this.effectiveWikitext = anyTower.sourceWikitext ?? share.neowtext;
      this.effectiveWikitextSource = "share";
      this.originalWikitext = this.effectiveWikitext;
      this.isDirty = false;
      this.#wikitextStale = false;

      const savedDiff = anyTower.diffBaseline;
      if (savedDiff && Object.keys(savedDiff).length > 0) {
        this.baseline = savedDiff;
        this.baselineTowerId = towerName;
        this.baselineSkinName = null;
        this.baselineLocked = true;
      } else {
        this.baseline = {};
        this.baselineTowerId = null;
        this.baselineSkinName = null;
        this.baselineLocked = false;
      }

      const skins = tower.skinNames;
      if (!skins.includes(this.selectedSkinName)) {
        this.selectedSkinName = skins.includes("Regular")
          ? "Regular"
          : skins[0] || "";
      }

      return true;
    } finally {
      this.isLoading = false;
    }
  }

  async exitSharePreview(): Promise<boolean> {
    if (!this.sharePreviewId) return false;

    const name = this.selectedName;
    this.sharePreviewId = null;
    this.#shareSnapshotWikitext = "";
    this.#lastLoadedName = null;
    this.manager?.clearCache(name);

    if (name && this.names.includes(name)) {
      return await this.load(name);
    } else {
      this.unload();
      return true;
    }
  }

  async #reloadShareSnapshot(): Promise<boolean> {
    if (!this.manager || !this.selectedName || !this.#shareSnapshotWikitext) {
      return false;
    }

    const tower = await this.manager.getTower(this.selectedName, {
      wikitext: this.#shareSnapshotWikitext,
      ephemeral: true,
    });
    if (!tower) return false;

    this.selectedData = tower;
    this.effectiveWikitext = this.#shareSnapshotWikitext;
    this.originalWikitext = this.#shareSnapshotWikitext;
    this.effectiveWikitextSource = "share";
    this.isDirty = false;
    this.#wikitextStale = false;

    const savedDiff = (
      tower as unknown as { diffBaseline?: Record<string, unknown> }
    ).diffBaseline;
    if (savedDiff && Object.keys(savedDiff).length > 0) {
      this.baseline = savedDiff;
      this.baselineTowerId = this.selectedName;
      this.baselineSkinName = null;
      this.baselineLocked = true;
    } else {
      this.baseline = {};
      this.baselineTowerId = null;
      this.baselineSkinName = null;
      this.baselineLocked = false;
    }

    this.refresh();
    return true;
  }

  save(diffBaseline: Record<string, unknown> = {}): void {
    if (this.manager && this.selectedData) {
      const name = this.selectedData.name;

      if (this.sharePreviewId && name) {
        const lower = name.toLowerCase();
        const isKnown = this.names.some((n) => n.toLowerCase() === lower);
        if (!isKnown) {
          guaraCustomTower(name);
          if (!this.names.some((n) => n.toLowerCase() === lower)) {
            this.names = [...this.names, name].sort();
          }
        }
      }

      const newText = this.manager.saveTower(this.selectedData, diffBaseline);
      if (newText) {
        this.effectiveWikitext = newText;
        this.originalWikitext = newText;
        this.effectiveWikitextSource = "override";
        this.isDirty = false;
        this.#wikitextStale = false;
        if (Object.keys(diffBaseline).length > 0) {
          this.baselineTowerId = this.selectedData.name;
          this.baselineSkinName = null;
          this.baselineLocked = true;
        } else {
          this.baselineLocked = false;
        }
        if (this.sharePreviewId) {
          this.sharePreviewId = null;
          this.#shareSnapshotWikitext = "";
          this.#lastLoadedName = this.selectedData.name;
        }

        if (name) {
          this.manager.getTowerNames(true).then((updated) => {
            this.names = updated;
          });
        }
      }
    }
  }

  async discardChanges(): Promise<boolean> {
    if (this.sharePreviewId) {
      if (this.isDirty) return await this.#reloadShareSnapshot();
      return await this.exitSharePreview();
    }

    this.effectiveWikitext = this.originalWikitext;
    this.isDirty = false;
    this.#wikitextStale = false;
    return await this.forceReload();
  }

  clearDiff(): void {
    let changed = false;

    const eff = this.effectiveWikitext || "";
    const cleanedEff = stripSeDiff(eff);
    if (cleanedEff !== eff) {
      this.effectiveWikitext = cleanedEff;
      changed = true;
    }

    if (Object.keys(this.baseline).length > 0) {
      this.baseline = {};
      this.baselineLocked = false;
      changed = true;
    }

    if (changed) {
      this.isDirty = true;
      this.#wikitextStale = false;
    }
  }

  isCustomSelected(): boolean {
    return isCustomTower(this.selectedName);
  }

  async createTower(name: string): Promise<string | null> {
    if (!this.manager) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    if (!addCustomTower(trimmed, this.names)) return null;
    this.names = await this.manager.getTowerNames(true);
    return trimmed;
  }

  async deleteTower(): Promise<boolean> {
    if (!this.manager || !this.selectedData) return false;
    const name = this.selectedData.name;
    if (!isCustomTower(name)) return false;

    this.manager.deleteTower(name);
    this.names = await this.manager.getTowerNames(true);
    this.unload();
    return true;
  }

  async confirmDeleteTower(): Promise<boolean> {
    if (!(await this.deleteTower())) return false;

    const url = new URL(page.url);
    url.searchParams.delete("tower");
    goto(url, { keepFocus: true, noScroll: true });
    return true;
  }

  /**
   * Resets the current tower to defaults and reloads it.
   */
  async reset(): Promise<boolean> {
    if (!this.manager || !this.selectedData) return false;

    const name = this.selectedData.name;

    if (settingsStore.debugMode)
      console.log(`[TowerStore] Resetting tower: ${name}`);

    this.isLoading = true;
    this.selectedData = null;

    this.manager.resetTower(name);
    this.#lastLoadedName = null;

    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;
    this.baselineLocked = false;

    if (settingsStore.debugMode)
      console.log(`[TowerStore] Baseline cleared for reset.`);

    const result = await this.load(name);
    return result;
  }

  /**
   * Forces a reload of the current tower.
   */
  async forceReload(): Promise<boolean> {
    // If there are any in-memory unsaved changes,
    // please don't blow them away by reloading
    // from base/override sources PLEASE.
    if (this.isDirty) return true;

    this.#lastLoadedName = null;
    if (this.selectedName) {
      if (this.manager) {
        this.manager.clearCache(this.selectedName);
      }
      return await this.load(this.selectedName);
    }
    return false;
  }

  unload(): void {
    this.selectedData = null;
    this.selectedName = "";
    this.#lastLoadedName = null;
    this.effectiveWikitext = "";
    this.effectiveWikitextSource = "";
    this.originalWikitext = "";
    this.isDirty = false;
    this.#wikitextStale = false;
    this.sharePreviewId = null;
    this.#shareSnapshotWikitext = "";
    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;
  }

  addGlobalModifierColumn(column: string): boolean {
    const trimmed = column.trim();
    if (!trimmed) return false;

    if (
      this.globalModifier.entries.some((entry) =>
        columnKeysEqual(entry.column, trimmed),
      )
    ) {
      return false;
    }

    this.globalModifier.entries = [
      ...this.globalModifier.entries,
      { column: trimmed, delta: 0, percent: 0, enabled: true },
    ];
    return true;
  }

  removeGlobalModifierEntry(index: number): void {
    this.globalModifier.entries = this.globalModifier.entries.filter(
      (_, i) => i !== index,
    );
  }

  setGlobalModifierEnabled(index: number, enabled: boolean): void {
    const entries = [...this.globalModifier.entries];
    entries[index] = { ...entries[index], enabled };
    this.globalModifier.entries = entries;
  }

  setGlobalModifierDelta(index: number, raw: string): void {
    const delta = parseNumeric(raw);
    const entries = [...this.globalModifier.entries];
    entries[index] = {
      ...entries[index],
      delta: Number.isFinite(delta) ? delta : 0,
    };
    this.globalModifier.entries = entries;
  }

  setGlobalModifierPercent(index: number, raw: string): void {
    const percent = parseNumeric(raw);
    const entries = [...this.globalModifier.entries];
    entries[index] = {
      ...entries[index],
      percent: Number.isFinite(percent) ? percent : 0,
    };
    this.globalModifier.entries = entries;
  }
}

export const towerStore = new TowerStore();
