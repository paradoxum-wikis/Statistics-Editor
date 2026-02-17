type SettingBoolean = {
  key: string;
  default: boolean;
};

type SettingString<T extends string> = {
  key: string;
  default: T;
};

const SETTINGS: {
  debugMode: SettingBoolean;
  seeValueDifference: SettingBoolean;
  theme: SettingString<"light" | "dark" | "system">;
} = {
  debugMode: {
    key: "tds_editor_debug",
    default: false,
  },
  seeValueDifference: {
    key: "tds_editor_see_value_difference",
    default: true,
  },
  theme: {
    key: "tds_editor_theme",
    default: "system",
  },
};

function readBooleanSetting(def: SettingBoolean): boolean {
  if (typeof localStorage === "undefined") return def.default;
  const raw = localStorage.getItem(def.key);
  if (raw == null) return def.default;
  return raw === "true";
}

function writeBooleanSetting(def: SettingBoolean, value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(def.key, String(value));
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
  debugMode = $state(SETTINGS.debugMode.default);
  seeValueDifference = $state(SETTINGS.seeValueDifference.default);
  theme = $state(SETTINGS.theme.default);

  constructor() {
    this.debugMode = readBooleanSetting(SETTINGS.debugMode);
    this.seeValueDifference = readBooleanSetting(SETTINGS.seeValueDifference);
    this.theme = readStringSetting(SETTINGS.theme);
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

  setDebug(value: boolean) {
    this.debugMode = value;
    writeBooleanSetting(SETTINGS.debugMode, value);
  }

  setSeeValueDifference(value: boolean) {
    this.seeValueDifference = value;
    writeBooleanSetting(SETTINGS.seeValueDifference, value);
  }

  setTheme(value: "light" | "dark" | "system") {
    this.theme = value;
    writeStringSetting(SETTINGS.theme, value);
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
