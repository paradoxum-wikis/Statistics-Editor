import {
  deprecatedFn,
  FNC_NAMES,
  FSE_NAMES,
  type DollarRef,
} from "./tokens";

const HELP_PAGE = "https://tds.fandom.com/wiki/Help:Neowtext";

const FNC: Record<string, string> = {
  COST: "An array of upgrade costs for each level starting from Level 0 (e.g., 8250; 3250; 7500).",
  BRANCH:
    "An array of table names to indicate which table corresponds to which upgrade branch, depending on the branch's declaration order on the schema.",
  INDEX:
    "By default, tables are indexed by their first column. Override that column; supports numbers, ranges (1-3), and inclusive or (1/3A).",
  RECURSION:
    "Copy-down: stores the cell's other content and injects it into later cells in the column that contain $FNC-RECURSION$. The chain breaks at the first cell without the tag.",
  ROFBUG: `Specifies which columns should calculate with the current Rate of Fire bug in mind.
• ROFBUG: The latest Rate of Fire bug, currently pinned as Modern.
• ROFBUG-2019: Pre-Overhaul Rate of Fire bug.
• ROFBUG-2020: Overhaul Rate of Fire bug.
• ROFBUG-2022: Modern Rate of Fire bug.
Later declarations take priority.`,
  SCHEMA:
    "Overrides the default order of any functions that use a level schema, such as UPGRADE. Use N for the trunk.",
  TOTALPRICE:
    "Sums $FNC-COST$ from level 0 up to the current level. Supports @N and @N@branch pins; trunk is assumed if no branch is given.",
};

const FSE: Record<string, string> = {
  CATEGORY: `Category on the Statistics Editor home page (e.g., Golden Perks). "Custom" if empty.
Deprecated; use META.`,
  DETECTION:
    "A 3-item array of levels where the tower gains Hidden, Lead, and Flying. Empty is a passthrough; -1 means never. Each SCHEMA split path adds 3 more slots. All values start at -1.",
  META: 'Category and image on the Statistics Editor home page (e.g., Evolved; File:DefaultOperator0.png). "Custom" if empty.',
  UPGRADE: `An array of upgrade titles starting from Level 1 (e.g., Radar; Stronger Ammunition; Dual Turret).
Respects SCHEMA.`,
  UPGRADEICON: `An array of image filenames or Roblox asset IDs for upgrade icons starting from Level 1 (e.g., File:Radar.png; File:Turret3.png).
Respects SCHEMA.`,
};

const TOTAL = `For any variable: $FNC-TOTAL-NAME$ sums $NAME$ from level 0 up to the current level. Works with a semicolon array or a formula / #expr. Supports @N and @N@branch pins.
Do not use this in place of $FNC-TOTALPRICE$.`;

const DOT =
  "Pull a column from a specific table (Table.Column). Untitled tables inherit the Regular title in the same position. Supports @N and @N@branch pins.";

const VAR =
  "Declare in a <var> block as $Name$ = value. A name without the dollar syntax will be treated as a table column if it matches one.";

export function helpHash(ref: DollarRef): string {
  if (ref.kind === "var" && ref.base.includes(".")) return "Dot_Notation";
  if (ref.kind === "fnc") {
    const name = ref.name!.toUpperCase();
    if (name.startsWith("TOTAL-") && name !== "TOTALPRICE") return "TOTAL";
    if (name.startsWith("ROFBUG")) return "ROFBUG";
    if (FNC_NAMES.has(name) || deprecatedFn(ref)) return name;
    return "FNC";
  }
  if (ref.kind === "fse") {
    return FSE_NAMES.has(ref.name!.toUpperCase()) ? ref.name!.toUpperCase() : "FSE";
  }
  return "Variables";
}

export function helpUrl(ref: DollarRef): string {
  return `${HELP_PAGE}#${helpHash(ref)}`;
}

export function describeRef(ref: DollarRef): string {
  if (ref.empty) return "Empty $...$.";
  if (ref.pinError) return ref.pinError;
  if ((ref.kind === "fnc" || ref.kind === "fse") && ref.name) {
    const upper = ref.name.toUpperCase();
    if (ref.kind === "fnc" && upper.startsWith("TOTAL-") && upper !== "TOTALPRICE") {
      return TOTAL;
    }
    if (ref.kind === "fnc" && upper.startsWith("ROFBUG")) return FNC.ROFBUG;
    const text =
      ref.kind === "fse"
        ? FSE[upper]
        : (FNC[upper] ?? (deprecatedFn(ref) ? FSE[upper] : undefined));
    if (!text) return `Unknown ${ref.prefix}.`;
    const extra = [
      ref.pvp ? "PVP-scoped; inherits the non-PVP value if unset." : "",
      deprecatedFn(ref) ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    return extra ? `${text}\n${extra}` : text;
  }
  if (ref.kind === "var" && ref.base.includes(".")) return DOT;
  return VAR;
}

export function kindLabel(ref: DollarRef): string {
  const pin =
    ref.pinLevel !== undefined
      ? ` · @${ref.pinLevel}${ref.pinBranch ? `@${ref.pinBranch}` : ""}`
      : "";
  if (ref.kind === "fnc")
    return (ref.pvp ? "Function · PVP" : "Function") + pin;
  if (ref.kind === "fse")
    return (
      (ref.pvp
        ? "Function Statistics Editor · PVP"
        : "Function Statistics Editor") + pin
    );
  if (ref.kind === "var" && ref.base.includes(".")) return "Dot notation" + pin;
  return "Variable";
}
