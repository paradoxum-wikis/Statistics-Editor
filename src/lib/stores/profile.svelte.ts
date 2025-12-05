import TowerManager from "$lib/towerComponents/towerManager";
import { settingsStore } from "$lib/stores/settings.svelte";

/**
 * Reactive user profile manager that hopefully works.
 */
class ProfileStore {
  current = $state("Default");
  list = $state<string[]>([]);

  /**
   * Sets up profiles from TowerManager and logs if debug mode is on.
   */
  init() {
    this.list = TowerManager.getProfiles();
    if (settingsStore.debugMode) {
      console.log(`[ProfileStore] Initialized with profiles:`, this.list);
      console.log(`[ProfileStore] Current profile: ${this.current}`);
    }
  }

  switch(name: string): boolean {
    if (name && name !== this.current) {
      if (settingsStore.debugMode) {
        console.log(
          `[ProfileStore] Switching profile from "${this.current}" to "${name}"`,
        );
      }
      this.current = name;
      return true;
    }
    return false;
  }

  create(name: string): boolean {
    if (!name) return false;
    if (settingsStore.debugMode) {
      console.log(`[ProfileStore] Creating new profile: "${name}"`);
    }
    TowerManager.addProfile(name);
    this.list = TowerManager.getProfiles();
    this.current = name;
    return true;
  }

  delete(name: string): boolean {
    if (name === "Default") return false;
    if (settingsStore.debugMode) {
      console.log(`[ProfileStore] Deleting profile: "${name}"`);
    }
    TowerManager.deleteProfile(name);
    this.list = TowerManager.getProfiles();
    if (this.current === name) {
      if (settingsStore.debugMode) {
        console.log(
          `[ProfileStore] Deleted current profile, switching to Default`,
        );
      }
      this.current = "Default";
    }
    return true;
  }
}

export const profileStore = new ProfileStore();
