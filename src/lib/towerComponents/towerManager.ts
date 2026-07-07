import Tower from "./tower";
import { towerNames } from "./towers";
import { fetchTowerWiki } from "$lib/services/fetchTowerWiki";
import { resolveToken, type TableCache } from "$lib/neowtext/functions";
import { parseWikitext, type TableData } from "$lib/neowtext/parser";
import { patchWikitext } from "$lib/neowtext/patcher";
import {
  clearProfileWikiOverrides,
  clearTowerWikiOverrides,
  clearWikiOverride,
  loadEffectiveWikitext,
  setWikiOverride,
} from "$lib/neowtext/wikiSource";
import {
  getCustomTowers,
  isCustomTower,
  removeCustomTower,
} from "./customTowers";
import { stripRefs } from "$lib/utils/format";
import { embedSeDirectives, extractDirectives, stripSeMeta } from "$lib/neowtext/directives";

const wikitextFiles = import.meta.glob("./towers/*.wiki", {
  query: "?raw",
  import: "default",
});

export default class TowerManager {
  towerNames: string[] = [];
  towers: { [name: string]: Tower } = {};

  constructor(
    public dataKey: string | null,
    private debug: () => boolean = () => false,
  ) {}

  static getProfiles(): string[] {
    if (typeof localStorage === "undefined") return ["Default"];
    try {
      const profiles = JSON.parse(
        localStorage.getItem("tds_profiles") || '["Default"]',
      );
      return Array.isArray(profiles) ? profiles : ["Default"];
    } catch {
      return ["Default"];
    }
  }

  static addProfile(name: string): void {
    if (typeof localStorage === "undefined") return;
    const profiles = this.getProfiles();
    if (!profiles.includes(name)) {
      localStorage.setItem("tds_profiles", JSON.stringify([...profiles, name]));
    }
  }

  static deleteProfile(name: string): void {
    if (typeof localStorage === "undefined" || name === "Default") return;
    const profiles = this.getProfiles().filter((p) => p !== name);
    localStorage.setItem("tds_profiles", JSON.stringify(profiles));
    clearProfileWikiOverrides(name);
  }

  /**
   * Generates the wikitext for the given tower without saving it
   * to storage or updating the source overrider.
   * Useful for "unsaved changes" previews.
   */
  generateWikitext(tower: Tower): string | null {
    const src = (tower as any).sourceWikitext;
    if (!src) return null;
    try {
      return patchWikitext(stripSeMeta(src), tower);
    } catch (err) {
      console.error(
        `[TowerManager] Failed to generate wikitext for ${tower.name}:`,
        err,
      );
      return null;
    }
  }

  saveTower(
    tower: Tower,
    diffBaseline: Record<string, unknown> = {},
    memo = "",
  ): string | null {
    if (this.debug())
      console.log(`[TowerManager] saveTower called for ${tower.name}`);
    if (!this.dataKey) return null;

    const src = (tower as { sourceWikitext?: string }).sourceWikitext;
    if (!src) return null;

    const patched = patchWikitext(stripSeMeta(src), tower);
    if (!patched) return null;

    const withDirectives = embedSeDirectives(patched, {
      memo,
      baseline: diffBaseline,
    });
    if (this.debug())
      console.log(
        `[TowerManager] Patched wikitext length: ${withDirectives.length}`,
      );
    setWikiOverride(this.dataKey ?? "Default", tower.name, withDirectives);
    Object.assign(tower, {
      sourceWikitext: withDirectives,
      wikitextSource: "override",
      diffBaseline,
      editorMemo: memo,
    });
    return withDirectives;
  }

  clearCache(name: string): void {
    if (this.debug()) console.log(`[TowerManager] clearing cache for ${name}`);
    if (this.towers[name]) delete this.towers[name];
  }

  resetTower(name: string): void {
    if (!this.dataKey) return;

    clearWikiOverride(this.dataKey ?? "Default", name);
    this.clearCache(name);
  }

  deleteTower(name: string): void {
    if (!isCustomTower(name)) return;

    removeCustomTower(name);
    clearTowerWikiOverrides(name);
    this.clearCache(name);
    this.towerNames = this.towerNames.filter((n) => n !== name);
  }

  async getTower(
    name: string,
    opts?: { wikitext?: string; ephemeral?: boolean },
  ): Promise<Tower | null> {
    const ephemeral = opts?.ephemeral === true;
    if (!ephemeral && this.towers[name]) {
      if (this.debug())
        console.log(`[TowerManager] Returning cached tower for ${name}`);
      return this.towers[name];
    }

    if (this.debug())
      console.log(`[TowerManager] Loading tower ${name} (no cache)`);

    const wikitextLoader = wikitextFiles[`./towers/${name}.wiki`];
    const custom = isCustomTower(name);
    if (!wikitextLoader && !custom && opts?.wikitext === undefined) return null;

    let currentSource = "";
    let currentText = "";

    const countVarBlocks = (source: string): number =>
      (source.match(/<var\b[^>]*>[\s\S]*?<\/var>/gi) || []).length;

    try {
      const loadBase = async () => {
        if (custom) return "";

        try {
          const url = new URL(`./towers/${name}.wiki`, import.meta.url).href;
          if (this.debug())
            console.log(`[TowerManager] Fetching wikitext from: ${url}`);
          const res = await fetch(`${url}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const text = await res.text();
          if (this.debug()) console.log("[TowerManager] Fetch successful");
          return text;
        } catch (e) {
          console.warn(
            "[TowerManager] Fetch failed, falling back to loader:",
            e,
          );
          try {
            if (wikitextLoader) {
              const loaded = await wikitextLoader();
              if (loaded) return loaded as string;
            }
          } catch (loaderErr) {
            console.warn("[TowerManager] Loader failed:", loaderErr);
          }
        }

        try {
          const wikiText = await fetchTowerWiki(name);
          if (wikiText) {
            if (this.debug())
              console.log(
                `[TowerManager] Fetched wikitext from TDS Wiki for ${name} as fallback`,
              );
            return wikiText;
          }
        } catch (err) {
          console.warn(
            `[TowerManager] Failed to fetch from TDS Wiki for ${name}:`,
            err,
          );
        }

        return "";
      };

      if (opts?.wikitext !== undefined) {
        currentSource = "override";
        currentText = opts.wikitext;
      } else {
        const { source, text } = await loadEffectiveWikitext(
          this.dataKey ?? "Default",
          name,
          loadBase,
        );
        currentSource = source;
        currentText = text;
      }
      const { text: parseText, baseline: diffBaseline, memo } =
        extractDirectives(currentText);
      if (this.debug())
        console.log(
          `[TowerManager] Loaded effective wikitext from ${currentSource}, length: ${currentText.length}, se-diff cells: ${Object.keys(diffBaseline).length}, se-memo chars: ${memo.length}`,
        );

      const parsed = parseWikitext(parseText);
      if (this.debug()) {
        console.log(`[TowerManager] Using wikitext source: ${currentSource}`);
        console.log("[TowerManager] Wikitext diagnostics:", {
          hasVarOpenTag: /<var\b/i.test(currentText),
          hasVarCloseTag: /<\/var>/i.test(currentText),
          varBlockCount: countVarBlocks(currentText),
          preview: currentText.slice(0, 300),
        });
        console.log("[TowerManager] Parsed Variables:", parsed.variables);
      }

      const towerJson: any = {};

      function buildTableCache(
        tables: TableData[],
        indexOverrides: Record<string, string>,
      ): TableCache {
        const cache: TableCache = {};
        for (const table of tables) {
          if (!table.name) continue;
          const cleanName = stripRefs(table.name).trim();
          const indexCol =
            indexOverrides[cleanName] ||
            indexOverrides[table.name] ||
            table.headers[0];
          const tCache: Record<number, Record<string, string | number>> = {};
          for (const row of table.rows) {
            const s = String(row[indexCol] ?? "");
            const range = s.match(/^(\d+)[^\d]+(\d+)$/);
            if (range) {
              for (let l = parseInt(range[1]); l <= parseInt(range[2]); l++)
                tCache[l] = row;
            } else {
              const n = parseInt(s);
              if (!isNaN(n)) tCache[n] = row;
            }
          }
          cache[table.name] = tCache;
          cache[cleanName] = tCache;
          cache[cleanName.replace(/\s+/g, "")] = tCache;
        }
        return cache;
      }

      const buildSkinJson = (
        tableData: TableData,
        isPvp: boolean,
        extraTables: TableData[],
        primaryTableIndex: number,
        variantPrefix: string,
      ) => {
        const defaults: any = {};
        const upgrades: any[] = [];
        const readOnly = new Set<string>();

        const expandPrimaryRows = (
          sourceRows: Record<string, string | number>[],
        ): Record<string, string | number>[] => {
          const expanded: Record<string, string | number>[] = [];

          for (const row of sourceRows) {
            const levelRaw = String(row["Level"] ?? "").trim();
            const range = levelRaw.match(/^(\d+)\s*-\s*(\d+)$/);
            if (!range) {
              expanded.push(row);
              continue;
            }

            const start = Number(range[1]);
            const end = Number(range[2]);
            if (
              !Number.isFinite(start) ||
              !Number.isFinite(end) ||
              end < start
            ) {
              expanded.push(row);
              continue;
            }

            for (let lvl = start; lvl <= end; lvl++) {
              expanded.push({ ...row, Level: lvl });
            }
          }

          return expanded;
        };

        const rows = expandPrimaryRows(tableData.rows);

        const formulaTokens = { ...parsed.variables };
        if (variantPrefix) {
          const prefixToken = `$${variantPrefix}-`;
          Object.entries(parsed.variables).forEach(([k, v]) => {
            if (k.startsWith(prefixToken)) {
              formulaTokens[`$${k.slice(prefixToken.length)}`] = v;
            }
          });
        }

        const getArr = (val?: string) =>
          val ? val.split(";").map((s) => s.trim()) : [];
        const v = parsed.variables;
        const indexOverrides: Record<string, string> = {};
        const indexVal = v["$FNC-INDEX$"];
        if (indexVal) {
          for (const entry of indexVal.split(";")) {
            const m = entry.trim().match(/^(.+)\.([^.]+)$/);
            if (m) indexOverrides[m[1].trim()] = m[2].trim();
          }
        }
        const tableCache = buildTableCache(
          [tableData, ...extraTables],
          indexOverrides,
        );
        const branchMapping: Record<string, string> = {};
        const branchNames = (
          isPvp && v["$FNC-PVP-BRANCH$"]
            ? getArr(v["$FNC-PVP-BRANCH$"])
            : getArr(v["$FNC-BRANCH$"])
        ).filter(Boolean);

        const schemaStr = v["$FNC-SCHEMA$"];
        const schema = schemaStr ? getArr(schemaStr).filter(Boolean) : null;

        if (schema && schema.length > 0) {
          const trunkLetter = schema[0] || "N";
          const uniqueBranches = Array.from(new Set(schema)).filter(
            (x) => x !== trunkLetter,
          );
          branchNames.forEach((name, i) => {
            if (name && uniqueBranches[i])
              branchMapping[name] = uniqueBranches[i];
          });
        }

        const baseCosts = getArr(v["$FNC-COST$"]);
        const baseDetects = getArr(v["$FNC-DETECTION$"]);
        const baseUpgs = getArr(v["$FNC-UPGRADE$"]);
        const baseIcons = getArr(v["$FNC-UPGRADEICON$"]);
        const variantFnc = (suffix: string) =>
          variantPrefix ? `$FNC-${variantPrefix}-${suffix}$` : "";

        const mergeArrays = (base: string[], pvp?: string[]) => {
          if (!pvp || pvp.length === 0) return base;
          const max = Math.max(base.length, pvp.length);
          return Array.from({ length: max }, (_, i) => {
            const pv = pvp[i]?.trim();
            return pv !== undefined && pv !== "" ? pv : (base[i] ?? "");
          });
        };

        const costs = mergeArrays(baseCosts, getArr(v[variantFnc("COST")]));
        const detects = mergeArrays(
          baseDetects,
          getArr(v[variantFnc("DETECTION")]),
        );
        const upgs = mergeArrays(baseUpgs, getArr(v[variantFnc("UPGRADE")]));
        const icons = mergeArrays(
          baseIcons,
          getArr(v[variantFnc("UPGRADEICON")]),
        );

        formulaTokens["$FNC-COST$"] = costs.join("; ");
        formulaTokens["$FNC-DETECTION$"] = detects.join("; ");
        formulaTokens["$FNC-UPGRADE$"] = upgs.join("; ");
        formulaTokens["$FNC-UPGRADEICON$"] = icons.join("; ");
        const variantBranch = v[variantFnc("BRANCH")];
        if (variantBranch !== undefined) {
          formulaTokens["$FNC-BRANCH$"] = variantBranch;
        }

        const getIndex = (lvl: number, branch: string) => {
          if (!schema) return lvl;
          const trunkLetter = schema[0] || "N";
          const tBranch = branch || trunkLetter;
          let tLvl = 0;
          const bLvls: Record<string, number> = {};
          for (let i = 0; i < schema.length; i++) {
            const letter = schema[i] || trunkLetter;
            if (letter === trunkLetter) {
              if (tBranch === trunkLetter && tLvl === lvl) return i;
              tLvl++;
            } else {
              if (bLvls[letter] === undefined) bLvls[letter] = tLvl;
              if (tBranch === letter && bLvls[letter] === lvl) return i;
              bLvls[letter]++;
            }
          }
          return -1;
        };

        const globalDetections = Array.from(
          { length: schema ? schema.length : rows.length },
          () => ({ Hidden: false, Lead: false, Flying: false }),
        );

        const branchNamesList = [
          schema ? schema[0] || "N" : "N",
          ...(schema
            ? Array.from(new Set(schema)).filter(
                (x) => x !== (schema[0] || "N"),
              )
            : []),
        ];

        for (let i = 0; i < detects.length; i++) {
          const s = detects[i]?.trim();
          if (!s) continue;
          const lvl = Number(s);
          if (!Number.isFinite(lvl)) continue;

          const branchIdx = Math.floor(i / 3);
          const typeIdx = i % 3;

          const branch = branchNamesList[branchIdx] || branchNamesList[0];
          const type = ["Hidden", "Lead", "Flying"][typeIdx];

          const globalIdx = getIndex(
            lvl,
            branch === branchNamesList[0] ? "" : branch,
          );
          if (globalIdx >= 0 && globalIdx < globalDetections.length) {
            globalDetections[globalIdx][type as "Hidden" | "Lead" | "Flying"] =
              true;
          }
        }

        const getParent = (idx: number) => {
          if (idx <= 0) return -1;
          if (!schema) return idx - 1;
          const trunkLetter = schema[0] || "N";
          const letter = schema[idx];
          if (letter === trunkLetter) return idx - 1;

          const firstOccur = schema.indexOf(letter);
          if (idx === firstOccur) {
            return schema.lastIndexOf(trunkLetter);
          } else {
            return idx - 1;
          }
        };

        for (let i = 0; i < globalDetections.length; i++) {
          const parentIdx = getParent(i);
          if (parentIdx >= 0) {
            if (globalDetections[parentIdx].Hidden)
              globalDetections[i].Hidden = true;
            if (globalDetections[parentIdx].Lead)
              globalDetections[i].Lead = true;
            if (globalDetections[parentIdx].Flying)
              globalDetections[i].Flying = true;
          }
        }

        const cellFormulaTokens: Record<string, Record<string, string>> = {};
        let prevPrice = 0;

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const row = rows[rowIdx];
          const numericLevel = Number(row["Level"]);
          const levelKey = String(rowIdx);
          cellFormulaTokens[levelKey] ??= {};
          const formulaEntries = (Object.entries(row) as [string, unknown][])
            .map(([k, v]): [string, string, string] | null => {
              if (typeof v !== "string") return null;
              const stripped = stripRefs(v).trim();
              if (
                !/\$[^$]+\$/.test(stripped) &&
                !/^{{#expr:.*}}$/i.test(stripped)
              )
                return null;
              return [k, stripped, v];
            })
            .filter((x): x is [string, string, string] => x !== null);

          for (let pass = 0; pass < 2; pass++) {
            for (const [key, val, ogVal] of formulaEntries) {
              const result = resolveToken(
                val,
                Number.isFinite(numericLevel) ? numericLevel : rowIdx,
                row,
                formulaTokens,
                isPvp,
                0,
                tableCache,
                false,
                false,
                undefined,
                undefined,
                variantPrefix,
              );
              if (result !== undefined) {
                cellFormulaTokens[levelKey][key] = ogVal;
                row[key] = result;
                const stripped = stripRefs(ogVal).trim();
                const refSuffix = stripped.match(
                  /^(-?[\d.,]+)((\$[A-Z0-9_-]+\$)+)$/,
                );
                const refOnly =
                  !!refSuffix &&
                  (refSuffix[2].match(/\$[A-Z0-9_-]+\$/g) ?? []).every((v) =>
                    /^<ref\b/i.test((formulaTokens[v] ?? "").trim()),
                  );
                if (
                  !refOnly &&
                  (/\$[^$]+\$/.test(stripped) ||
                    /^{{#expr:.*}}$/i.test(stripped))
                ) {
                  readOnly.add(key);
                }
              }
            }
          }

          const tpRaw = row["Total Price"];
          const totalPrice =
            typeof tpRaw === "string"
              ? Number(tpRaw.replace(/[^0-9.-]+/g, ""))
              : Number(tpRaw);

          const detections: Record<string, boolean> = {};
          const idx = Number.isFinite(numericLevel)
            ? getIndex(numericLevel, "")
            : -1;

          if (idx >= 0 && idx < globalDetections.length) {
            const gd = globalDetections[idx];
            const parentIdx = getParent(idx);
            const parentGd =
              parentIdx >= 0
                ? globalDetections[parentIdx]
                : { Hidden: false, Lead: false, Flying: false };

            for (const type of ["Hidden", "Lead", "Flying"] as const) {
              if (gd[type]) {
                detections[type] = true;
                if (!parentGd[type] && this.debug()) {
                  console.log(
                    `[TowerManager] Found detection var ${type} at level ${numericLevel}`,
                  );
                }
              }
            }
          }

          if (Number.isFinite(numericLevel) && numericLevel === 0) {
            Object.assign(defaults, row, { Price: totalPrice });
            if (Object.keys(detections).length)
              defaults.Detections = detections;
            prevPrice = totalPrice;
          } else {
            const idx = Number.isFinite(numericLevel)
              ? getIndex(numericLevel, "")
              : -1;
            const parsedCost =
              idx >= 0 ? Number(costs[idx]?.replace(/[^0-9.-]+/g, "")) : NaN;
            const cost = !isNaN(parsedCost)
              ? parsedCost
              : totalPrice - prevPrice;
            prevPrice = totalPrice;

            const upgrade: any = {
              Cost: cost,
              Stats: { ...row },
              Level: numericLevel,
            };
            if (Object.keys(detections).length)
              upgrade.Stats.Detections = detections;

            const upgIndex = idx >= 0 ? idx - 1 : -1;

            if (upgIndex >= 0 && upgs[upgIndex]) upgrade.Title = upgs[upgIndex];
            if (upgIndex >= 0 && icons[upgIndex])
              upgrade.Image = icons[upgIndex];

            upgrades.push(upgrade);
          }
        }

        const resolvedExtraTables = extraTables.map((extra) => {
          const extraReadOnly = new Set<string>();
          for (const r of extra.rows) {
            for (const [k, val] of Object.entries(r)) {
              if (typeof val !== "string") continue;
              const stripped = stripRefs(val).trim();
              const refSuffix = stripped.match(
                /^(-?[\d.,]+)((\$[A-Z0-9_-]+\$)+)$/,
              );
              const refOnly =
                !!refSuffix &&
                (refSuffix[2].match(/\$[A-Z0-9_-]+\$/g) ?? []).every((v) =>
                  /^<ref\b/i.test((formulaTokens[v] ?? "").trim()),
                );
              if (
                !refOnly &&
                (/\$[^$]+\$/.test(stripped) || /^{{#expr:.*}}$/i.test(stripped))
              ) {
                extraReadOnly.add(k);
              }
            }
          }

          if (extra.headers.includes("Total Price")) {
            extraReadOnly.add("Total Price");
          }

          const cellFormulaTokens: Record<string, Record<string, string>> = {};
          const bSuffix = branchMapping[extra.name.trim()] || "";

          return {
            ...extra,
            readOnlyColumns: Array.from(extraReadOnly),
            branchSuffix: bSuffix,
            cellFormulaTokens,
            rows: extra.rows.map((row, extraIdx) => {
              const resRow = { ...row };
              const levelKey = String(extraIdx);
              cellFormulaTokens[levelKey] ??= {};
              const numericLevel = Number(resRow["Level"]);

              const levelVal = Number.isFinite(numericLevel)
                ? String(resRow["Level"]) + (bSuffix ? bSuffix : "")
                : extraIdx;

              const formulaEntries = (
                Object.entries(resRow) as [string, unknown][]
              )
                .map(([k, v]): [string, string, string] | null => {
                  if (typeof v !== "string") return null;
                  const stripped = stripRefs(v).trim();
                  if (
                    !/\$[^$]+\$/.test(stripped) &&
                    !/^{{#expr:.*}}$/i.test(stripped)
                  )
                    return null;
                  return [k, stripped, v];
                })
                .filter((x): x is [string, string, string] => x !== null);

              for (let pass = 0; pass < 2; pass++) {
                for (const [key, val, ogVal] of formulaEntries) {
                  const result = resolveToken(
                    val,
                    levelVal,
                    resRow,
                    formulaTokens,
                    isPvp,
                    0,
                    tableCache,
                    false,
                    false,
                    undefined,
                    undefined,
                    variantPrefix,
                  );
                  if (result !== undefined) {
                    cellFormulaTokens[levelKey][key] = ogVal;
                    resRow[key] = result;
                  }
                }
              }

              return resRow;
            }),
          };
        });

        for (const extra of resolvedExtraTables) {
          const bSuffix = extra.branchSuffix;
          if (!bSuffix) continue;
          for (const resRow of extra.rows) {
            const numericLevel = Number(resRow["Level"]);
            if (Number.isFinite(numericLevel) && numericLevel > 0) {
              const idx = getIndex(numericLevel, bSuffix);
              const parsedCost =
                idx >= 0 ? Number(costs[idx]?.replace(/[^0-9.-]+/g, "")) : NaN;
              const cost = !isNaN(parsedCost) ? parsedCost : 0;
              const levelVal =
                String(resRow["Level"]) + (bSuffix ? bSuffix : "");

              const upgrade: any = {
                Cost: cost,
                Stats: { ...resRow },
                Level: levelVal,
              };

              if (idx >= 0 && idx < globalDetections.length) {
                const gd = globalDetections[idx];
                const detections: Record<string, boolean> = {};
                const parentIdx = getParent(idx);
                const parentGd =
                  parentIdx >= 0
                    ? globalDetections[parentIdx]
                    : { Hidden: false, Lead: false, Flying: false };

                for (const type of ["Hidden", "Lead", "Flying"] as const) {
                  if (gd[type]) {
                    detections[type] = true;
                    if (!parentGd[type] && this.debug()) {
                      console.log(
                        `[TowerManager] Found detection var ${type} at level ${numericLevel}`,
                      );
                    }
                  }
                }
                if (Object.keys(detections).length)
                  upgrade.Stats.Detections = detections;
              }

              const upgIndex = idx >= 0 ? idx - 1 : -1;

              if (upgIndex >= 0 && upgs[upgIndex])
                upgrade.Title = upgs[upgIndex];
              if (upgIndex >= 0 && icons[upgIndex])
                upgrade.Image = icons[upgIndex];

              upgrades.push(upgrade);
            }
          }
        }

        return {
          Defaults: defaults,
          Upgrades: upgrades,
          Headers: tableData.headers,
          RawHeaders: tableData.rawHeaders,
          TableName: tableData.name || "",
          RawRows: rows,
          ReadOnly: Array.from(readOnly),
          FormulaTokens: formulaTokens,
          CellFormulaTokens: cellFormulaTokens,
          IsPvp: isPvp,
          MoneyColumns: tableData.moneyColumns ?? [],
          ExtraTables: resolvedExtraTables,
          TableCache: buildTableCache(
            [{ ...tableData, rows }, ...resolvedExtraTables],
            indexOverrides,
          ),
          PrimaryTableIndex: primaryTableIndex,
          VariantPrefix: variantPrefix,
        };
      };

      const tabPrefix = (tabName: string) =>
        tabName.trim().replace(/[^a-zA-Z0-9]+/g, "");

      for (const [tabName, tables] of Object.entries(parsed.tabs)) {
        const isPvp = /pvp/i.test(tabName);
        const variantPrefix = tabPrefix(tabName);
        const pIdx = (tables as TableData[]).findIndex((t) =>
          t.headers.includes("Level"),
        );
        const primaryTable = pIdx !== -1 ? tables[pIdx] : tables[0];
        const extraTables = (tables as TableData[]).filter(
          (_, i) => i !== Math.max(0, pIdx),
        );

        towerJson[tabName] = buildSkinJson(
          primaryTable,
          isPvp,
          extraTables,
          Math.max(0, pIdx),
          variantPrefix,
        );
      }

      const towerData = new Tower(name, towerJson);
      Object.assign(towerData, {
        sourceWikitext: currentText,
        wikitextSource: currentSource,
        diffBaseline,
        editorMemo: memo,
      });

      if (ephemeral) return towerData;
      return (this.towers[name] = towerData);
    } catch (err) {
      console.error("Failed to load wikitext for", name, ":", err);
      const towerData = new Tower(name, {});
      const { baseline: diffBaseline, memo } = extractDirectives(currentText);
      Object.assign(towerData, {
        sourceWikitext: currentText,
        wikitextSource: currentSource,
        diffBaseline,
        editorMemo: memo,
      });
      if (ephemeral) return towerData;
      return (this.towers[name] = towerData);
    }
  }

  async getTowerNames(refresh = false): Promise<string[]> {
    if (!refresh && this.towerNames.length) return this.towerNames;
    const custom = getCustomTowers();
    return (this.towerNames = [...new Set([...towerNames, ...custom])].sort());
  }
}
