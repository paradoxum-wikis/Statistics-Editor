import TowerManager from "$lib/towerComponents/towerManager";
import type Tower from "$lib/towerComponents/tower";
import { settingsStore } from "$lib/stores/settings.svelte";

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

  baseline = $state<Record<string, unknown>>({});
  baselineTowerId = $state<string | null>(null);
  baselineSkinName = $state<string | null>(null);

  /**
   * Canonical source of truth for what the UI should be editing/viewing.
   *
   * - This is the effective wikitext used to build `selectedData`
   *   (either the base file or a profile override).
   * - Wiki mode should bind to this, and after saving,
   *	 we can reload or parse it back into `selectedData`.
   */
  effectiveWikitext = $state<string>("");

  /**
   * Where the effective wikitext came from.
   */
  effectiveWikitextSource = $state<"override" | "base" | "">("");

  /**
   * Original wikitext before any unsaved changes.
   */
  originalWikitext = $state<string>("");

  /**
   * Sets up the tower manager with a profile and loads tower names.
   */
  async init(profile: string): Promise<void> {
    this.manager = new TowerManager(profile);
    this.names = await this.manager.getTowerNames();
  }

  /**
   * Switches to a new profile, clearing state and reloading if a tower was selected.
   */
  async switchProfile(profile: string): Promise<void> {
    this.manager = new TowerManager(profile);
    this.#lastLoadedName = null;
    this.selectedData = null;
    this.effectiveWikitext = "";
    this.effectiveWikitextSource = "";
    this.originalWikitext = "";
    this.isDirty = false;
    this.baseline = {};
    this.baselineTowerId = null;
    this.baselineSkinName = null;
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
      return false;
    }

    if (name === this.#lastLoadedName) {
      return true;
    }

    if (settingsStore.debugMode) console.log(`Starting to load tower: ${name}`);
    if (settingsStore.debugMode) console.time(`Load tower ${name}`);
    this.isLoading = true;

    try {
      const tower = await this.manager.getTower(name);
      if (tower) {
        this.selectedData = tower;
        this.selectedName = name;
        this.#lastLoadedName = name;

        const anyTower = tower as unknown as {
          sourceWikitext?: string;
          wikitextSource?: "override" | "base";
        };
        this.effectiveWikitext = anyTower.sourceWikitext ?? "";
        this.effectiveWikitextSource = anyTower.wikitextSource ?? "";
        this.originalWikitext = this.effectiveWikitext;
        this.isDirty = false;

        if (this.baselineTowerId !== name) {
          this.baseline = {};
          this.baselineTowerId = null;
          this.baselineSkinName = null;
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
  syncWikitext(): void {
    if (this.manager && this.selectedData) {
      const generated = this.manager.generateWikitext(this.selectedData);
      if (generated) {
        this.effectiveWikitext = generated;
        this.isDirty = true;
      }
    }
  }

  /**
   * Persists changes to storage.
   */
  save(): void {
    if (this.manager && this.selectedData) {
      const newText = this.manager.saveTower(this.selectedData);
      if (newText) {
        this.effectiveWikitext = newText;
        this.originalWikitext = newText;
        this.effectiveWikitextSource = "override";
        this.isDirty = false;
      }
    }
  }

  discardChanges(): void {
    this.effectiveWikitext = this.originalWikitext;
    this.isDirty = false;
    void this.forceReload();
  }

  /**
   * Resets the current tower to defaults and reloads it.
   */
  async reset(): Promise<boolean> {
    if (!this.manager || !this.selectedData) return false;

    this.isLoading = true;
    this.manager.resetTower(this.selectedData.name);
    this.#lastLoadedName = null;
    const result = await this.load(this.selectedData.name);
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
}

export const towerStore = new TowerStore();
