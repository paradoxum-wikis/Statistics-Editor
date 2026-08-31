/** @import { Plugin } from "vite" */
/** @import { TowerMeta } from "./parse.js" */
import { parseTowerMeta } from "./parse.js";
import { hashFactoryText } from "./hash.js";

const TOWERS_DIR = `${process.cwd()}/src/lib/towerComponents/towers`;
const VIRTUAL_ID = "virtual:towers";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * @param {string} file
 * @returns {Promise<{ name: string, meta: TowerMeta | null, hash: string }>}
 */
async function readTowerEntry(file) {
	const name = file.slice(0, -5);
	const content = await Bun.file(`${TOWERS_DIR}/${file}`).text();
	return {
		name,
		meta: parseTowerMeta(content),
		hash: hashFactoryText(content),
	};
}

/**
 * @returns {Promise<{ towerNames: string[], metaEntries: [string, TowerMeta][], towerHashes: Record<string, string> }>}
 */
async function scanTowers() {
	const glob = new Bun.Glob("*.wiki");
	const wikiFiles = Array.from(glob.scanSync({ cwd: TOWERS_DIR }));

	const scanned = await Promise.all(wikiFiles.map(readTowerEntry));

	const towerNames = scanned
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
	/** @type {[string, TowerMeta][]} */
	const metaEntries = [];
	/** @type {Record<string, string>} */
	const towerHashes = {};
	for (const entry of scanned) {
		towerHashes[entry.name.toLowerCase()] = entry.hash;
		if (entry.meta) metaEntries.push([entry.name, entry.meta]);
	}

	return { towerNames, metaEntries, towerHashes };
}

/**
 * @param {{ towerNames: string[], metaEntries: [string, TowerMeta][], towerHashes: Record<string, string> }} data
 */
function serializeModule(data) {
	return `export const towerNames = ${JSON.stringify(data.towerNames)};
export const metaEntries = ${JSON.stringify(data.metaEntries)};
export const towerHashes = ${JSON.stringify(data.towerHashes)};`;
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
