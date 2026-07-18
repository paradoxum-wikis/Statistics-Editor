/**
 * FNC- : **f**u**nc**tions that are understood both by the wiki and this editor.
 * FSE- : **f**unctions that are exclusive to this editor, the **S**tatistics **E**ditor.
 *
 * Exceptions are DETECTION/UPGRADE/UPGRADEICON for compatibility reasons,
 * FNC- versions are accepted on read but migrated to FSE- on save.
 */
const FSE_BASES = ["DETECTION", "UPGRADE", "UPGRADEICON", "CATEGORY"];
const COMPATIBILITY_FSE = ["DETECTION", "UPGRADE", "UPGRADEICON"];

function isFseSuffix(suffix: string): boolean {
  const clean = suffix.replace(/^PVP-/, "").toUpperCase();
  return FSE_BASES.includes(clean);
}

function getDefaultPrefix(suffix: string): "FNC" | "FSE" {
  return isFseSuffix(suffix) ? "FSE" : "FNC";
}

export function getFncKeys(suffix: string, variantPrefix?: string): string[] {
  const keys: string[] = [];
  const bases = variantPrefix
    ? [`${variantPrefix}-${suffix}`, suffix]
    : [suffix];
  const defaultPre = getDefaultPrefix(suffix);
  for (const base of bases) {
    keys.push(`$${defaultPre}-${base}$`);
  }
  const clean = suffix.replace(/^PVP-/, "").toUpperCase();
  if (COMPATIBILITY_FSE.includes(clean)) {
    const otherPre = defaultPre === "FSE" ? "FNC" : "FSE";
    for (const base of bases) {
      keys.push(`$${otherPre}-${base}$`);
    }
  }
  return keys;
}

export function getFncValue(
  tokens: Record<string, string>,
  suffix: string,
  variantPrefix?: string,
): string | undefined {
  for (const key of getFncKeys(suffix, variantPrefix)) {
    if (tokens[key] !== undefined) return tokens[key];
  }
  return undefined;
}

export function getEffectiveFncKey(
  tokens: Record<string, string>,
  suffix: string,
  variantPrefix?: string,
): string {
  for (const key of getFncKeys(suffix, variantPrefix)) {
    if (tokens[key] !== undefined) return key;
  }
  const pre = getDefaultPrefix(suffix);
  return variantPrefix
    ? `$${pre}-${variantPrefix}-${suffix}$`
    : `$${pre}-${suffix}$`;
}

export function getDefaultFncKey(
  suffix: string,
  variantPrefix?: string,
): string {
  const pre = getDefaultPrefix(suffix);
  return variantPrefix
    ? `$${pre}-${variantPrefix}-${suffix}$`
    : `$${pre}-${suffix}$`;
}

export function getVariantFncKey(
  tokens: Record<string, string>,
  variantPrefix: string | undefined,
  suffix: string,
): string {
  for (const key of getFncKeys(suffix, variantPrefix)) {
    if (tokens[key] !== undefined) return key;
  }
  return getDefaultFncKey(suffix, variantPrefix);
}
