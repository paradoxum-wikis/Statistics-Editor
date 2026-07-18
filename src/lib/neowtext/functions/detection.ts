import {
  getSchemaIndex,
  getSchemaParent,
  schemaBranches,
  schemaIndexToLevel,
} from "./schema";

export {
  parseSchema,
  schemaBranches,
  getSchemaIndex,
  getSchemaParent,
  schemaIndexToLevel,
  levelsOnBranch,
} from "./schema";

export const DETECTION_TYPES = ["Hidden", "Lead", "Flying"] as const;
export type DetectionType = (typeof DETECTION_TYPES)[number];
export type DetectionFlags = Record<DetectionType, boolean>;

export function effectiveDetectionStart(
  flags: DetectionFlags[],
  schema: string[] | null,
  branch: string,
  type: DetectionType,
): number | null {
  const trunk = schemaBranches(schema)[0];
  const path = branch || trunk;

  for (let i = 0; i < flags.length; i++) {
    if (!flags[i][type]) continue;
    const { level, branch: slotBranch } = schemaIndexToLevel(schema, i);
    const b = slotBranch || trunk;
    if (path === trunk) {
      if (b === trunk) return level;
      continue;
    }
    if (b === trunk || b === path) return level;
  }
  return null;
}

export function parseDetectionArray(
  detects: string[],
  schema: string[] | null,
  slotCount: number,
): DetectionFlags[] {
  const branches = schemaBranches(schema);
  const trunk = branches[0];
  const result: DetectionFlags[] = Array.from({ length: slotCount }, () => ({
    Hidden: false,
    Lead: false,
    Flying: false,
  }));

  for (let i = 0; i < detects.length; i++) {
    const s = detects[i]?.trim();
    if (!s) continue;
    const lvl = Number(s);
    if (!Number.isFinite(lvl) || lvl < 0) continue;

    const branchIdx = Math.floor(i / 3);
    const typeIdx = i % 3;
    if (typeIdx >= DETECTION_TYPES.length) continue;

    const branch = branches[branchIdx] || trunk;
    const type = DETECTION_TYPES[typeIdx];
    const globalIdx = getSchemaIndex(
      schema,
      lvl,
      branch === trunk ? "" : branch,
    );
    if (globalIdx >= 0 && globalIdx < result.length) {
      result[globalIdx][type] = true;
    }
  }

  for (let i = 0; i < result.length; i++) {
    const parentIdx = getSchemaParent(schema, i);
    if (parentIdx < 0) continue;
    for (const type of DETECTION_TYPES) {
      if (result[parentIdx][type]) result[i][type] = true;
    }
  }

  return result;
}

export function serializeDetectionFlags(
  flags: DetectionFlags[],
  schema: string[] | null,
): string {
  const branches = schemaBranches(schema);
  const trunk = branches[0];
  const parts: string[] = [];

  for (const branch of branches) {
    for (const type of DETECTION_TYPES) {
      let found = "";
      for (let i = 0; i < flags.length; i++) {
        if (!flags[i][type]) continue;
        const parentIdx = getSchemaParent(schema, i);
        if (parentIdx >= 0 && flags[parentIdx][type]) continue;
        const { level, branch: slotBranch } = schemaIndexToLevel(schema, i);
        if ((slotBranch || trunk) !== branch) continue;
        found = String(level);
        break;
      }
      parts.push(found);
    }
  }

  while (parts.length > DETECTION_TYPES.length) {
    const tail = parts.slice(-DETECTION_TYPES.length);
    if (tail.some((p) => p !== "")) break;
    parts.length -= DETECTION_TYPES.length;
  }

  return parts.join("; ").trimEnd();
}

export function flagsFromSkinJson(
  skinJson: {
    Defaults?: { Detections?: Partial<Record<DetectionType, boolean>> };
    Upgrades?: {
      Stats?: { Detections?: Partial<Record<DetectionType, boolean>> };
    }[];
  },
  schema: string[] | null,
): DetectionFlags[] {
  const slotCount = schema?.length ?? 1 + (skinJson.Upgrades?.length ?? 0);
  const flags: DetectionFlags[] = Array.from({ length: slotCount }, () => ({
    Hidden: false,
    Lead: false,
    Flying: false,
  }));

  if (skinJson.Defaults?.Detections) {
    for (const type of DETECTION_TYPES) {
      if (skinJson.Defaults.Detections[type]) flags[0][type] = true;
    }
  }

  skinJson.Upgrades?.forEach((up, idx) => {
    const si = idx + 1;
    if (si >= slotCount || !up.Stats?.Detections) return;
    for (const type of DETECTION_TYPES) {
      if (up.Stats.Detections[type]) flags[si][type] = true;
    }
  });

  return flags;
}

export function extractDetectionGains(
  flags: DetectionFlags[],
  schema: string[] | null,
): Record<string, Partial<Record<DetectionType, number>>> {
  const branches = schemaBranches(schema);
  const trunk = branches[0];
  const gains: Record<string, Partial<Record<DetectionType, number>>> = {};
  for (const b of branches) gains[b] = {};

  for (let i = 0; i < flags.length; i++) {
    const parentIdx = getSchemaParent(schema, i);
    const { level, branch: slotBranch } = schemaIndexToLevel(schema, i);
    const b = slotBranch || trunk;
    for (const type of DETECTION_TYPES) {
      if (!flags[i][type]) continue;
      if (parentIdx >= 0 && flags[parentIdx][type]) continue;
      if (gains[b][type] === undefined) gains[b][type] = level;
    }
  }
  return gains;
}

export function gainsToDetectArray(
  gains: Record<string, Partial<Record<DetectionType, number | null>>>,
  schema: string[] | null,
): string {
  const branches = schemaBranches(schema);
  const parts: string[] = [];
  for (const b of branches) {
    for (const type of DETECTION_TYPES) {
      const v = gains[b]?.[type];
      parts.push(
        v !== undefined && v !== null && Number.isFinite(v) ? String(v) : "",
      );
    }
  }
  return parts.join("; ");
}
