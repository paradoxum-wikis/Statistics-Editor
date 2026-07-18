import { stripRefs } from "$lib/utils/format";
import { getFncValue, getVariantFncKey } from "./keys";

export function parseSchema(schemaStr: string | undefined): string[] | null {
  if (!schemaStr) return null;
  const schema = schemaStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  return schema.length ? schema : null;
}

/** Trunk first, then unique non-trunk letters in SCHEMA order. */
export function schemaBranches(schema: string[] | null): string[] {
  if (!schema?.length) return ["N"];
  const trunk = schema[0] || "N";
  const rest: string[] = [];
  const seen = new Set<string>();
  for (const letter of schema) {
    if (letter !== trunk && !seen.has(letter)) {
      seen.add(letter);
      rest.push(letter);
    }
  }
  return [trunk, ...rest];
}

export function getSchemaIndex(
  schema: string[] | null,
  level: number,
  branch: string,
): number {
  if (!schema) return level;
  const trunk = schema[0] || "N";
  const tBranch = branch || trunk;
  let tLvl = 0;
  const bLvls: Record<string, number> = {};
  for (let i = 0; i < schema.length; i++) {
    const letter = schema[i] || trunk;
    if (letter === trunk) {
      if (tBranch === trunk && tLvl === level) return i;
      tLvl++;
    } else {
      if (bLvls[letter] === undefined) bLvls[letter] = tLvl;
      if (tBranch === letter && bLvls[letter] === level) return i;
      bLvls[letter]++;
    }
  }
  return -1;
}

export function getSchemaParent(schema: string[] | null, idx: number): number {
  if (idx <= 0) return -1;
  if (!schema) return idx - 1;
  const trunk = schema[0] || "N";
  const letter = schema[idx];
  if (letter === trunk) return idx - 1;
  const firstOccur = schema.indexOf(letter);
  if (idx === firstOccur) return schema.lastIndexOf(trunk);
  return idx - 1;
}

export function schemaIndexToLevel(
  schema: string[] | null,
  idx: number,
): { level: number; branch: string } {
  if (!schema) return { level: idx, branch: "N" };
  const trunk = schema[0] || "N";
  let tLvl = 0;
  const bLvls: Record<string, number> = {};
  for (let i = 0; i < schema.length; i++) {
    const letter = schema[i] || trunk;
    if (letter === trunk) {
      if (i === idx) return { level: tLvl, branch: trunk };
      tLvl++;
    } else {
      if (bLvls[letter] === undefined) bLvls[letter] = tLvl;
      if (i === idx) return { level: bLvls[letter], branch: letter };
      bLvls[letter]++;
    }
  }
  return { level: -1, branch: trunk };
}

export function levelsOnBranch(
  schema: string[] | null,
  branch: string,
  slotCount: number,
): number[] {
  const trunk = schemaBranches(schema)[0];
  const b = branch || trunk;
  const levels: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    const { level, branch: slotBranch } = schemaIndexToLevel(schema, i);
    if ((slotBranch || trunk) === b) levels.push(level);
  }
  return levels;
}

export function buildBranchMap(
  tokens: Record<string, string>,
  variantPrefix?: string,
): Record<string, string> {
  const schemaStr = getFncValue(tokens, "SCHEMA");
  if (!schemaStr) return {};

  const schema = schemaStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const trunkLetter = schema[0] || "N";

  const seen = new Set<string>();
  const branchLetters: string[] = [];
  for (const letter of schema) {
    if (letter !== trunkLetter && !seen.has(letter)) {
      seen.add(letter);
      branchLetters.push(letter);
    }
  }

  const branchKey = getVariantFncKey(tokens, variantPrefix, "BRANCH");
  const branchMap: Record<string, string> = {};
  const branchNames = (tokens[branchKey] || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  branchNames.forEach((name, i) => {
    const letter = branchLetters[i];
    if (!letter) return;
    branchMap[name] = letter;
    branchMap[name.replace(/\s+/g, "")] = letter;
  });

  return branchMap;
}

export function resolveBranchSpec(
  branchSpec: string,
  branchMap: Record<string, string>,
): string {
  const clean = stripRefs(branchSpec).trim();
  if (!clean) return "";
  return branchMap[clean] ?? branchMap[clean.replace(/\s+/g, "")] ?? clean;
}

export function parseLevelNumber(level: number | string): number {
  const parsed = typeof level === "number" ? level : parseInt(level, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseLevelBranch(level: number | string): string {
  if (typeof level !== "string") return "";
  return level.match(/[A-Za-z]+$/)?.[0] ?? "";
}
