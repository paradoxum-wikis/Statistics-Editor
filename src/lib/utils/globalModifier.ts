import { columnKeysEqual, toNumericValue } from "$lib/utils/format";

export type GlobalModifierEntry = {
  column: string;
  delta: number;
  percent: number;
  enabled: boolean;
};

export type GlobalModifier = {
  entries: GlobalModifierEntry[];
};

export function isGlobalModifierActive(modifier: GlobalModifier): boolean {
  return modifier.entries.some(
    (entry) => entry.enabled && (entry.delta !== 0 || entry.percent !== 0),
  );
}

export function applyGlobalModifierDisplay(
  modifier: GlobalModifier,
  header: string,
  value: string | number | null | undefined,
): string | number | null | undefined {
  if (modifier.entries.length === 0) return value;

  let result = toNumericValue(value);
  if (result === null) return value;

  let changed = false;

  for (const entry of modifier.entries) {
    if (!entry.enabled || !entry.column.trim()) continue;
    if (entry.delta === 0 && entry.percent === 0) continue;
    if (!columnKeysEqual(entry.column, header)) continue;

    if (entry.percent !== 0) {
      result *= 1 + entry.percent / 100;
      changed = true;
    }
    if (entry.delta !== 0) {
      result += entry.delta;
      changed = true;
    }
  }

  return changed ? result : value;
}
