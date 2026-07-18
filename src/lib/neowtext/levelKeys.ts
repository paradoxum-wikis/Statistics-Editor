export type TableRowCache = Record<
  string | number,
  Record<string, string | number>
>;

export function parseLevelKeys(raw: string): (string | number)[] {
  const s = String(raw).replace(/\s+/g, "");
  if (!s) return [];

  const keys: (string | number)[] = [];
  const seen = new Set<string>();
  const add = (k: string | number) => {
    const sk = String(k);
    if (seen.has(sk)) return;
    seen.add(sk);
    keys.push(k);
  };

  const addPart = (part: string) => {
    if (!part) return;
    const pathRange = part.match(
      /^(\d+)([A-Za-z]+)[^\dA-Za-z]+(\d+)([A-Za-z]+)$/,
    );
    if (
      pathRange &&
      pathRange[2].toUpperCase() === pathRange[4].toUpperCase()
    ) {
      const L = pathRange[2].toUpperCase();
      for (let n = +pathRange[1]; n <= +pathRange[3]; n++) add(`${n}${L}`);
      return;
    }
    const pathOne = part.match(/^(\d+)([A-Za-z]+)$/);
    if (pathOne) {
      add(`${pathOne[1]}${pathOne[2].toUpperCase()}`);
      return;
    }
    const range = part.match(/^(\d+)[^\d]+(\d+)$/);
    if (range) {
      for (let i = +range[1]; i <= +range[2]; i++) add(i);
      return;
    }
    const num = Number(part);
    if (Number.isFinite(num)) add(num);
  };

  for (const part of s.split("/")) addPart(part);
  return keys;
}

export function getTableCacheRowAt(
  tCache: TableRowCache | undefined,
  level: number,
  branch?: string,
): Record<string, string | number> | undefined {
  if (!tCache) return undefined;
  if (branch) {
    const row = tCache[`${level}${branch}`];
    if (row) return row;
  }
  return tCache[level];
}

export function indexRowsByLevelKeys(
  rows: Record<string, string | number>[],
  indexCol: string,
): TableRowCache {
  const tCache: TableRowCache = {};
  for (const row of rows) {
    for (const key of parseLevelKeys(String(row[indexCol] ?? ""))) {
      tCache[key] = row;
    }
  }
  return tCache;
}
