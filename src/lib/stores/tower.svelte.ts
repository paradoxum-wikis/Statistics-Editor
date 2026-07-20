import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import TowerManager from "$lib/towerComponents/towerManager";
import type Tower from "$lib/towerComponents/tower";
import { settingsStore } from "$lib/stores/settings.svelte";
import {
  addCustomTower,
  guaraCustomTower,
  isCustomTower,
} from "$lib/towerComponents/customTowers";
import {
  collectCompareValues,
  mergeBaselineOnTowerDiff,
} from "$lib/utils/towah";
import {
  embedSeDirectives,
  extractSeMemo,
  hasSeDiff,
  stripSeDiff,
} from "$lib/neowtext/directives";
import {
  fetchShare,
  parseShareRef,
  type ShareOwner,
} from "$lib/services/shareTower";
import { analytics } from "$lib/services/analytics";

const RECENT_KEY = "tdse_recent_towers";
const RECENT_MAX = 8;

function readRecentTowers(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === "string" && !!n.trim())
      : [];
  } catch (e) {
    if (settingsStore.debugMode) console.error("[tower] recent towers", e);
    return [];
  }
}

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
  missingTower = $state(false);
  recentNames = $state<string[]>(readRecentTowers());
  #lastLoadedName = $state<string | null>(null);
  #lastTrackedSelect: string | null = null;

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
  shareOwner = $state.raw<ShareOwner | null>(null);
  #shareSnapshotWikitext = "";

  /**
   * Original wikitext before any unsaved changes.
   */
  originalWikitext = $state<string>("");

  editorMemo = $state("");
  #originalEditorMemo = "";

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
    this.#wikitextStale = false;
    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;
    this.baselineLocked = false;
    this.sharePreviewId = null;
    this.shareOwner = null;
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
    if (!this.manager || !name.trim()) {
      this.selectedData = null;
      this.effectiveWikitext = "";
      this.effectiveWikitextSource = "";
      this.originalWikitext = "";
      this.isDirty = false;
      this.#wikitextStale = false;
      this.sharePreviewId = null;
      this.shareOwner = null;
      this.#shareSnapshotWikitext = "";
      this.baseline = {};
      this.baselineTowerId = null;
      this.baselineSkinName = null;
      this.missingTower = false;
      return false;
    }

    if (this.sharePreviewId) {
      this.sharePreviewId = null;
      this.shareOwner = null;
      this.#shareSnapshotWikitext = "";
    }

    if (
      this.#lastLoadedName &&
      this.#lastLoadedName.toLowerCase() === name.trim().toLowerCase()
    ) {
      this.missingTower = false;
      return true;
    }

    if (settingsStore.debugMode) console.log(`Starting to load tower: ${name}`);
    if (settingsStore.debugMode) console.time(`Load tower ${name}`);
    this.isLoading = true;
    this.selectedData = null;
    this.missingTower = false;

    try {
      const tower = await this.manager.getTower(name);
      if (tower) {
        this.selectedData = tower;
        this.selectedName = tower.name;
        this.#lastLoadedName = tower.name;

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

        const loadedMemo =
          (tower as unknown as { editorMemo?: string }).editorMemo ?? "";
        this.editorMemo = loadedMemo;
        this.#originalEditorMemo = loadedMemo;

        this.#applyBaseline(
          tower,
          (tower as unknown as { diffBaseline?: Record<string, unknown> })
            .diffBaseline,
        );

        if (settingsStore.debugMode)
          console.log(`Loaded tower data for ${tower.name}`);
        this.#touchRecent(tower.name);
        if (this.#lastTrackedSelect !== tower.name) {
          this.#lastTrackedSelect = tower.name;
          analytics.track("select_content", {
            content_type: "tower",
            content_id: tower.name,
            source: this.effectiveWikitextSource,
          });
        }
        return true;
      } else {
        console.error(`Failed to load tower: ${name}`);
        this.selectedData = null;
        this.selectedName = "";
        this.#lastLoadedName = null;
        this.effectiveWikitext = "";
        this.effectiveWikitextSource = "";
        this.originalWikitext = "";
        this.isDirty = false;
        this.#wikitextStale = false;
        this.editorMemo = "";
        this.#originalEditorMemo = "";
        this.baseline = {};
        this.baselineTowerId = null;
        this.baselineSkinName = null;
        this.missingTower = true;
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

  #syncDirty(): void {
    this.isDirty =
      this.effectiveWikitext !== this.originalWikitext ||
      this.editorMemo !== this.#originalEditorMemo;
  }

  setEditorMemo(value: string): void {
    if (value === this.editorMemo) return;
    this.editorMemo = value;
    this.#syncDirty();
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
    return embedSeDirectives(this.effectiveWikitext, {
      memo: this.editorMemo,
      baseline: diffBaseline,
    });
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
    this.shareOwner = null;
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
      this.selectedName = tower.name;
      this.#lastLoadedName = `share:${tower.name}:${shareId}`;
      this.#shareSnapshotWikitext = share.neowtext;
      this.sharePreviewId = shareId;
      this.shareOwner = share.owner ?? null;
      this.missingTower = false;

      const anyTower = tower as unknown as {
        sourceWikitext?: string;
        diffBaseline?: Record<string, unknown>;
        editorMemo?: string;
      };
      this.effectiveWikitext = anyTower.sourceWikitext ?? share.neowtext;
      this.effectiveWikitextSource = "share";
      this.originalWikitext = this.effectiveWikitext;
      this.isDirty = false;
      this.#wikitextStale = false;

      const loadedMemo =
        anyTower.editorMemo ??
        extractSeMemo(anyTower.sourceWikitext ?? share.neowtext).memo;
      this.editorMemo = loadedMemo;
      this.#originalEditorMemo = loadedMemo;

      this.#applyBaseline(tower, anyTower.diffBaseline);

      const skins = tower.skinNames;
      if (!skins.includes(this.selectedSkinName)) {
        this.selectedSkinName = skins.includes("Regular")
          ? "Regular"
          : skins[0] || "";
      }

      analytics.track("share_import", {
        tower_name: towerName,
        success: true,
      });
      return true;
    } finally {
      this.isLoading = false;
    }
  }

  async exitSharePreview(): Promise<boolean> {
    if (!this.sharePreviewId) return false;

    const name = this.selectedName;
    this.sharePreviewId = null;
    this.shareOwner = null;
    this.#shareSnapshotWikitext = "";
    this.#lastLoadedName = null;
    this.manager?.clearCache(name);

    if (
      name &&
      this.names.some((n) => n.toLowerCase() === name.toLowerCase())
    ) {
      await goto(resolve("/tower/[name]", { name }), {
        replaceState: true,
        keepFocus: true,
        noScroll: true,
      });
      return true;
    }

    this.unload();
    await goto(resolve("/"), {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
    return true;
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

    const anyTower = tower as unknown as {
      diffBaseline?: Record<string, unknown>;
      editorMemo?: string;
    };
    const loadedMemo =
      anyTower.editorMemo ?? extractSeMemo(this.#shareSnapshotWikitext).memo;
    this.editorMemo = loadedMemo;
    this.#originalEditorMemo = loadedMemo;

    this.#applyBaseline(tower, anyTower.diffBaseline);

    this.refresh();
    return true;
  }

  save(diffBaseline: Record<string, unknown> = {}): void {
    if (this.manager && this.selectedData) {
      const name = this.selectedData.name;
      const fromShare = !!this.sharePreviewId;

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

      const newText = this.manager.saveTower(
        this.selectedData,
        diffBaseline,
        this.editorMemo,
      );
      if (newText) {
        this.effectiveWikitext = newText;
        this.originalWikitext = newText;
        this.#originalEditorMemo = this.editorMemo;
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
          this.shareOwner = null;
          this.#shareSnapshotWikitext = "";
          this.#lastLoadedName = this.selectedName;
          // so reload does not re-import over the applied profile data
          goto(resolve("/tower/[name]", { name: this.selectedName }), {
            replaceState: true,
            keepFocus: true,
            noScroll: true,
          });
        }

        if (name) {
          this.manager.getTowerNames(true).then((updated) => {
            this.names = updated;
          });
        }

        analytics.track("tower_save", {
          tower_name: name,
          has_diff: Object.keys(diffBaseline).length > 0,
          from_share: fromShare,
        });
      }
    }
  }

  async discardChanges(): Promise<boolean> {
    analytics.track("tower_discard", { tower_name: this.selectedName });

    if (this.sharePreviewId) {
      if (this.isDirty) return await this.#reloadShareSnapshot();
      return await this.exitSharePreview();
    }

    this.effectiveWikitext = this.originalWikitext;
    this.editorMemo = this.#originalEditorMemo;
    this.isDirty = false;
    this.#wikitextStale = false;
    return await this.forceReload();
  }

  clearDiff(): void {
    const eff = this.effectiveWikitext || "";
    const inSource = hasSeDiff(eff);
    if (!inSource && !this.baselineLocked) return;

    if (inSource) this.effectiveWikitext = stripSeDiff(eff);
    if (this.selectedData) this.#applyBaseline(this.selectedData);
    this.isDirty = true;
    this.#wikitextStale = false;
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
    analytics.track("tower_create", { tower_name: trimmed });
    return trimmed;
  }

  async deleteTower(): Promise<boolean> {
    if (!this.manager || !this.selectedData) return false;
    const name = this.selectedData.name;
    if (!isCustomTower(name)) return false;

    this.manager.deleteTower(name);
    this.names = await this.manager.getTowerNames(true);
    this.unload();
    analytics.track("tower_delete", { tower_name: name });
    return true;
  }

  async confirmDeleteTower(): Promise<boolean> {
    if (!(await this.deleteTower())) return false;
    goto(resolve("/"), { keepFocus: true, noScroll: true });
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
    if (result) analytics.track("tower_reset", { tower_name: name });
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
    this.#lastTrackedSelect = null;
    this.effectiveWikitext = "";
    this.effectiveWikitextSource = "";
    this.originalWikitext = "";
    this.isDirty = false;
    this.#wikitextStale = false;
    this.editorMemo = "";
    this.#originalEditorMemo = "";
    this.sharePreviewId = null;
    this.shareOwner = null;
    this.#shareSnapshotWikitext = "";
    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;
    this.missingTower = false;
  }

  #applyBaseline(
    tower: Tower,
    savedDiff?: Record<string, unknown> | null,
  ): void {
    const current = collectCompareValues(tower);
    if (savedDiff && Object.keys(savedDiff).length > 0) {
      // fill rest so formula cells are trackable
      this.baseline = { ...current, ...savedDiff };
      this.baselineTowerId = tower.name;
      this.baselineSkinName = null;
      this.baselineLocked = true;
      if (settingsStore.debugMode)
        console.log(
          `[TowerStore] Loaded @se-diff baseline (${Object.keys(savedDiff).length} cells, ${Object.keys(this.baseline).length} total)`,
        );
      return;
    }
    this.baseline = current;
    this.baselineTowerId = tower.name;
    this.baselineSkinName = null;
    this.baselineLocked = false;
  }

  #touchRecent(name: string): void {
    if (!name.trim() || typeof localStorage === "undefined") return;
    const next = [name, ...this.recentNames.filter((n) => n !== name)].slice(
      0,
      RECENT_MAX,
    );
    this.recentNames = next;
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  removeRecent(name: string): void {
    const next = this.recentNames.filter((n) => n !== name);
    if (next.length === this.recentNames.length) return;
    this.recentNames = next;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
  }
}

export const towerStore = new TowerStore();
