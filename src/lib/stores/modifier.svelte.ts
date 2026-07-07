import type { GlobalModifier } from "$lib/utils/globalModifier";
import { columnKeysEqual, parseNumeric } from "$lib/utils/format";

class ModifierStore {
  entries = $state<GlobalModifier["entries"]>([]);

  addColumn(column: string): boolean {
    const trimmed = column.trim();
    if (!trimmed) return false;

    if (this.entries.some((entry) => columnKeysEqual(entry.column, trimmed))) {
      return false;
    }

    this.entries = [
      ...this.entries,
      { column: trimmed, delta: 0, percent: 0, enabled: true },
    ];
    return true;
  }

  removeEntry(index: number): void {
    this.entries = this.entries.filter((_, i) => i !== index);
  }

  setEnabled(index: number, enabled: boolean): void {
    const next = [...this.entries];
    next[index] = { ...next[index], enabled };
    this.entries = next;
  }

  setDelta(index: number, raw: string): void {
    const delta = parseNumeric(raw);
    const next = [...this.entries];
    next[index] = {
      ...next[index],
      delta: Number.isFinite(delta) ? delta : 0,
    };
    this.entries = next;
  }

  setPercent(index: number, raw: string): void {
    const percent = parseNumeric(raw);
    const next = [...this.entries];
    next[index] = {
      ...next[index],
      percent: Number.isFinite(percent) ? percent : 0,
    };
    this.entries = next;
  }
}

export const modifierStore = new ModifierStore();
