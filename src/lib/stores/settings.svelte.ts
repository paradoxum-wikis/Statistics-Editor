type SettingBoolean = {
  key: string;
  default: boolean;
};

const SETTINGS: {
  debugMode: SettingBoolean;
  seeValueDifference: SettingBoolean;
} = {
  debugMode: {
    key: "tds_editor_debug",
    default: false,
  },
  seeValueDifference: {
    key: "tds_editor_see_value_difference",
    default: false,
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

class SettingsStore {
  debugMode = $state(SETTINGS.debugMode.default);
  seeValueDifference = $state(SETTINGS.seeValueDifference.default);

  constructor() {
    this.debugMode = readBooleanSetting(SETTINGS.debugMode);
    this.seeValueDifference = readBooleanSetting(SETTINGS.seeValueDifference);
  }

  setDebug(value: boolean) {
    this.debugMode = value;
    writeBooleanSetting(SETTINGS.debugMode, value);
  }

  setSeeValueDifference(value: boolean) {
    this.seeValueDifference = value;
    writeBooleanSetting(SETTINGS.seeValueDifference, value);
  }
}

export const settingsStore = new SettingsStore();
