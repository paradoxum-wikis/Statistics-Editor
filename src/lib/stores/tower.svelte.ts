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
  #lastLoadedName = $state<string | null>(null);

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
        if (settingsStore.debugMode)
          console.log(`Loaded tower data for ${name}`);
        return true;
      } else {
        console.error(`Failed to load tower: ${name}`);
        this.selectedData = null;
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

  save(): void {
    if (this.manager && this.selectedData) {
      this.manager.saveTower(this.selectedData);
    }
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
    this.#lastLoadedName = null;
    if (this.selectedName) {
      return await this.load(this.selectedName);
    }
    return false;
  }
}

export const towerStore = new TowerStore();
