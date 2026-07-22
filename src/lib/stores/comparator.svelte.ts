import type Tower from "$lib/towerComponents/tower";
import {
  X_LEVEL,
  type ComparatorSeriesDef,
  type ComparatorXKey,
} from "$lib/utils/statsChart";

class ComparatorStore {
  seriesDefs = $state<ComparatorSeriesDef[]>([]);
  xKey = $state<ComparatorXKey>(X_LEVEL);
  yUserDomain = $state<[number, number] | null>(null);
  towerCache = $state<Record<string, Tower>>({});
  addSeq = $state(0);
  #idSeq = 0;

  nextId(): string {
    return `s${++this.#idSeq}`;
  }

  setSeries(next: ComparatorSeriesDef[]) {
    this.seriesDefs = next;
    this.yUserDomain = null;
  }

  setXKey(key: ComparatorXKey) {
    this.xKey = key;
    this.yUserDomain = null;
  }

  cacheTower(name: string, tower: Tower) {
    this.towerCache = { ...this.towerCache, [name]: tower };
  }
}

export const comparatorStore = new ComparatorStore();
