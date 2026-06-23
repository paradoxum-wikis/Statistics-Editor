import { stripRefs, toNumericValue } from "$lib/utils/format";

export type GlobalModifierEntry = {
  column: string;
  delta: number;
  percent: number;
  enabled: boolean;
};

export type GlobalModifier = {
  entries: GlobalModifierEntry[];
};

export function applyGlobalModifierDisplay(
  modifier: GlobalModifier,
  header: string,
  value: string | number | null | undefined,
): string | number | null | undefined {
  if (modifier.entries.length === 0) return value;

  const cleanHeader = stripRefs(header).toLowerCase();
  let result = toNumericValue(value);
  if (result === null) return value;

  let changed = false;

  for (const entry of modifier.entries) {
    if (!entry.enabled || !entry.column.trim()) continue;
    if (entry.delta === 0 && entry.percent === 0) continue;
    if (stripRefs(entry.column).toLowerCase() !== cleanHeader) continue;

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
