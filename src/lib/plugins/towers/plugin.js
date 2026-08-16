/** @import { Plugin } from "vite" */
/** @import { TowerMeta } from "./parse.js" */
import { parseTowerMeta } from "./parse.js";

const TOWERS_DIR = `${process.cwd()}/src/lib/towerComponents/towers`;
const VIRTUAL_ID = "virtual:towers";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * @param {string} file
 * @returns {Promise<[string, TowerMeta | null]>}
 */
async function readTowerEntry(file) {
	const towerName = file.slice(0, -5);
	const content = await Bun.file(`${TOWERS_DIR}/${file}`).text();
	return [towerName, parseTowerMeta(content)];
}

/**
 * @param {[string, TowerMeta | null]} entry
 * @returns {entry is [string, TowerMeta]}
 */
function hasMeta(entry) {
	return entry[1] !== null;
}

/**
 * @returns {Promise<{ towerNames: string[], metaEntries: [string, TowerMeta][] }>}
 */
async function scanTowers() {
	const glob = new Bun.Glob("*.wiki");
	const wikiFiles = Array.from(glob.scanSync({ cwd: TOWERS_DIR }));

	const scanned = await Promise.all(wikiFiles.map(readTowerEntry));

	const towerNames = scanned
		.map(([name]) => name)
		.sort((a, b) => a.localeCompare(b));
	const metaEntries = scanned.filter(hasMeta);

	return { towerNames, metaEntries };
}

/**
 * @param {{ towerNames: string[], metaEntries: [string, TowerMeta][] }} data
 */
function serializeModule(data) {
	return `export const towerNames = ${JSON.stringify(data.towerNames)};
export const metaEntries = ${JSON.stringify(data.metaEntries)};`;
}

/**
 * @returns {Plugin}
 */
export function towersPlugin() {
	return {
		name: "towers",
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
		},
		async load(id) {
			if (id !== RESOLVED_ID) return;
			return serializeModule(await scanTowers());
		},
		handleHotUpdate({ file, server }) {
			if (!file.endsWith(".wiki") || !file.includes("towerComponents/towers")) {
				return;
			}
			const module = server.moduleGraph.getModuleById(RESOLVED_ID);
			return module ? [module] : undefined;
		},
	};
}
