import TowerManager from "$lib/towerComponents/towerManager";
import { settingsStore } from "$lib/stores/settings.svelte";

const CURRENT_PROFILE_KEY = "tds_current_profile";

/**
 * Reactive user profile manager that hopefully works.
 */
class ProfileStore {
  current = $state("Default");
  list = $state<string[]>([]);

  init() {
    this.list = TowerManager.getProfiles();
    const saved = localStorage.getItem(CURRENT_PROFILE_KEY);
    if (saved && this.list.includes(saved)) {
      this.current = saved;
    }
    if (settingsStore.debugMode) {
      console.log(`[ProfileStore] Initialized with profiles:`, this.list);
      console.log(`[ProfileStore] Current profile: ${this.current}`);
    }
  }

  switch(name: string): boolean {
    if (!name || name === this.current || !this.list.includes(name)) {
      return false;
    }

    if (settingsStore.debugMode) {
      console.log(
        `[ProfileStore] Switching profile from "${this.current}" to "${name}"`,
      );
    }
    this.current = name;
    localStorage.setItem(CURRENT_PROFILE_KEY, name);
    return true;
  }

  create(name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes("::") || this.list.includes(trimmed)) {
      return false;
    }

    if (settingsStore.debugMode) {
      console.log(`[ProfileStore] Creating new profile: "${trimmed}"`);
    }

    TowerManager.addProfile(trimmed);
    this.list = TowerManager.getProfiles();
    this.current = trimmed;
    localStorage.setItem(CURRENT_PROFILE_KEY, trimmed);
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
      localStorage.setItem(CURRENT_PROFILE_KEY, "Default");
    }
    return true;
  }
}

export const profileStore = new ProfileStore();
