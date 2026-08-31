declare module "virtual:towers" {
	export const towerNames: string[];
	export const metaEntries: [string, { category: string; image?: string }][];
	export const towerHashes: Record<string, string>;
}
