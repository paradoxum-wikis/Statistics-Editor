import type { Plugin, ViteDevServer } from "vite";
import { parseTowerCategory } from "./parse";
const TOWERS_DIR = `${process.cwd()}/src/lib/towerComponents/towers`;
const VIRTUAL_ID = "virtual:towers";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

async function scanTowers() {
  const glob = new Bun.Glob("*.wiki");
  const wikiFiles = Array.from(glob.scanSync({ cwd: TOWERS_DIR }));
  const towerNames: string[] = [];
  const categoryEntries: [string, string][] = [];

  for (const file of wikiFiles) {
    const towerName = file.slice(0, -5);
    towerNames.push(towerName);
    const content = await Bun.file(`${TOWERS_DIR}/${file}`).text();
    const category = parseTowerCategory(content);
    if (category) categoryEntries.push([towerName, category]);  }

  towerNames.sort((a, b) => a.localeCompare(b));
  return { towerNames, categoryEntries };
}

function serializeModule(data: Awaited<ReturnType<typeof scanTowers>>) {
  return `export const towerNames = ${JSON.stringify(data.towerNames)};
export const categoryEntries = ${JSON.stringify(data.categoryEntries)};`;
}

export function towersPlugin(): Plugin {
  return {
    name: "towers",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      return serializeModule(await scanTowers());
    },
    handleHotUpdate({ file, server }: { file: string; server: ViteDevServer }) {
      if (!file.endsWith(".wiki") || !file.includes("towerComponents/towers")) {
        return;
      }
      const module = server.moduleGraph.getModuleById(RESOLVED_ID);
      return module ? [module] : undefined;
    },
  };
}
