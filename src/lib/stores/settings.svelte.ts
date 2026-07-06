import type { Component } from "svelte";
import {
  Bug,
  Diff,
  Eraser,
  Scaling,
  Skull,
  SquareDashedBottom,
} from "@lucide/svelte";

export type SettingTab = "editor" | "appearance" | "advanced";

type BooleanSettingDef = {
  storageKey: string;
  default: boolean;
  id: string;
  tab: SettingTab;
  icon: Component;
  label: string;
  description: string;
};

const SETTING_DEFS = {
  clearOnEdit: {
    storageKey: "tdse_coe",
    default: true,
    id: "clear-on-edit",
    tab: "editor",
    icon: Eraser,
    label: "Clear Cell on Edit",
    description:
      "Clears the input box when you click on a cell instead of keeping whatever was already there.",
  },
  rofBug: {
    storageKey: "tdse_rof_bug",
    default: false,
    id: "rof-bug",
    tab: "editor",
    icon: Skull,
    label: "ROF Bug",
    description: "Calculate statistics with the infamous Rate of Fire bug.",
  },
  seeValueDifference: {
    storageKey: "tdse_see_delta",
    default: true,
    id: "see-value-difference",
    tab: "editor",
    icon: Diff,
    label: "See Difference by Default",
    description: "Always compare value differences when you open a tower.",
  },
  minTableWidth: {
    storageKey: "tdse_mctw",
    default: false,
    id: "min-content-table-width",
    tab: "appearance",
    icon: Scaling,
    label: "Compact Table Width",
    description:
      "Prevents the table from stretching to the full width, keeping it only as wide as necessary.",
  },
  hideCellWrapper: {
    storageKey: "tdse_hcw",
    default: true,
    id: "compact-cell",
    tab: "appearance",
    icon: SquareDashedBottom,
    label: "Compact Cell",
    description: "Uses tighter table cells, making tables leaner in general.",
  },
  debugMode: {
    storageKey: "tdse_debug",
    default: false,
    id: "debug-mode",
    tab: "advanced",
    icon: Bug,
    label: "Debug Mode",
    description: "Enables detailed logging in the console.",
  },
} as const satisfies Record<string, BooleanSettingDef>;

export type BooleanSettingKey = keyof typeof SETTING_DEFS;

export type BooleanSetting = BooleanSettingDef & { key: BooleanSettingKey };

export const BOOLEAN_SETTINGS: BooleanSetting[] = (
  Object.entries(SETTING_DEFS) as [BooleanSettingKey, BooleanSettingDef][]
).map(([key, def]) => ({ key, ...def }));

export function settingsForTab(tab: SettingTab): BooleanSetting[] {
  return BOOLEAN_SETTINGS.filter((setting) => setting.tab === tab);
}

type SettingString<T extends string> = {
  key: string;
  default: T;
};

const THEME_SETTING: SettingString<"light" | "dark" | "system"> = {
  key: "tdse_theme",
  default: "system",
};

function readBoolean(storageKey: string, defaultValue: boolean): boolean {
  if (typeof localStorage === "undefined") return defaultValue;
  const raw = localStorage.getItem(storageKey);
  if (raw == null) return defaultValue;
  return raw === "true";
}

function writeBoolean(storageKey: string, value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey, String(value));
}

function readStringSetting<T extends string>(def: SettingString<T>): T {
  if (typeof localStorage === "undefined") return def.default;
  const raw = localStorage.getItem(def.key);
  if (raw == null) return def.default;
  return raw as T;
}

function writeStringSetting<T extends string>(
  def: SettingString<T>,
  value: T,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(def.key, value);
}

class SettingsStore {
  debugMode = $state<boolean>(SETTING_DEFS.debugMode.default);
  seeValueDifference = $state<boolean>(SETTING_DEFS.seeValueDifference.default);
  hideCellWrapper = $state<boolean>(SETTING_DEFS.hideCellWrapper.default);
  minTableWidth = $state<boolean>(SETTING_DEFS.minTableWidth.default);
  clearOnEdit = $state<boolean>(SETTING_DEFS.clearOnEdit.default);
  rofBug = $state<boolean>(SETTING_DEFS.rofBug.default);
  theme = $state(THEME_SETTING.default);

  private assignBoolean(key: BooleanSettingKey, value: boolean) {
    switch (key) {
      case "clearOnEdit":
        this.clearOnEdit = value;
        break;
      case "rofBug":
        this.rofBug = value;
        break;
      case "seeValueDifference":
        this.seeValueDifference = value;
        break;
      case "minTableWidth":
        this.minTableWidth = value;
        break;
      case "hideCellWrapper":
        this.hideCellWrapper = value;
        break;
      case "debugMode":
        this.debugMode = value;
        break;
    }
  }

  constructor() {
    for (const key of Object.keys(SETTING_DEFS) as BooleanSettingKey[]) {
      const def = SETTING_DEFS[key];
      this.assignBoolean(key, readBoolean(def.storageKey, def.default));
    }
    this.theme = readStringSetting(THEME_SETTING);
  }

  init() {
    this.applyTheme(this.theme);

    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", () => {
        if (this.theme === "system") {
          this.applyTheme("system");
        }
      });
    }
  }

  getBoolean(key: BooleanSettingKey): boolean {
    switch (key) {
      case "clearOnEdit":
        return this.clearOnEdit;
      case "rofBug":
        return this.rofBug;
      case "seeValueDifference":
        return this.seeValueDifference;
      case "minTableWidth":
        return this.minTableWidth;
      case "hideCellWrapper":
        return this.hideCellWrapper;
      case "debugMode":
        return this.debugMode;
    }
  }

  setBoolean(key: BooleanSettingKey, value: boolean): void {
    this.assignBoolean(key, value);
    const def = SETTING_DEFS[key];
    writeBoolean(def.storageKey, value);
  }

  setTheme(value: "light" | "dark" | "system") {
    this.theme = value;
    writeStringSetting(THEME_SETTING, value);
    this.applyTheme(value);
  }

  private applyTheme(theme: "light" | "dark" | "system") {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

export const settingsStore = new SettingsStore();
