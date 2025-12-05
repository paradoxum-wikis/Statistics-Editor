/**
 * Handles app settings, such as debug mode.
 */
class SettingsStore {
  debugMode = $state(false);

  /**
   * Loads debug mode from localStorage on startup.
   */
  constructor() {
    if (typeof localStorage !== "undefined") {
      const storedDebug = localStorage.getItem("tds_editor_debug");
      this.debugMode = storedDebug === "true";
    }
  }

  toggleDebug() {
    this.debugMode = !this.debugMode;
    this.save();
  }

  setDebug(value: boolean) {
    this.debugMode = value;
    this.save();
  }

  save() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("tds_editor_debug", String(this.debugMode));
    }
  }
}

export const settingsStore = new SettingsStore();
