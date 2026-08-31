import { towerHashes } from "virtual:towers";
import { hasSeDiff, stripSeMeta } from "./directives";

export type FactorySyncAction = "keep" | "drift" | "compare";

export function getFactoryHash(name: string): string | undefined {
	return towerHashes[name.trim().toLowerCase()];
}

const ACK_PREFIX = "tdse_factory_ack::";
const BASE_PREFIX = "tdse_factory_base::";

function metaKey(prefix: string, profile: string, tower: string): string {
	return `${prefix}${profile}::${tower.trim().toLowerCase()}`;
}

function dropPrefix(prefix: string): void {
	if (typeof localStorage === "undefined") return;
	for (let i = localStorage.length - 1; i >= 0; i--) {
		const key = localStorage.key(i);
		if (key?.startsWith(prefix)) localStorage.removeItem(key);
	}
}

export function inspectOverride(
	override: string,
	factoryHash: string | undefined,
	storedHash?: string | null,
): FactorySyncAction {
	if (!factoryHash) return "keep";
	if (storedHash === factoryHash) return "keep";
	return hasSeDiff(override) ? "drift" : "compare";
}

export function sameFactoryBody(override: string, base: string): boolean {
	return stripSeMeta(override).trimEnd() === base.trimEnd();
}

export function getFactoryAck(profile: string, tower: string): string | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage.getItem(metaKey(ACK_PREFIX, profile, tower));
}

export function setFactoryAck(
	profile: string,
	tower: string,
	hash: string,
): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(metaKey(ACK_PREFIX, profile, tower), hash);
}

export function getFactoryBase(profile: string, tower: string): string | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage.getItem(metaKey(BASE_PREFIX, profile, tower));
}

export function setFactoryBase(
	profile: string,
	tower: string,
	hash: string | null,
): void {
	if (typeof localStorage === "undefined") return;
	const key = metaKey(BASE_PREFIX, profile, tower);
	if (hash) localStorage.setItem(key, hash);
	else localStorage.removeItem(key);
}

export function clearFactoryMeta(profile: string, tower: string): void {
	if (typeof localStorage === "undefined") return;
	localStorage.removeItem(metaKey(ACK_PREFIX, profile, tower));
	localStorage.removeItem(metaKey(BASE_PREFIX, profile, tower));
}

export function clearProfileFactoryMeta(profile: string): void {
	dropPrefix(`${ACK_PREFIX}${profile}::`);
	dropPrefix(`${BASE_PREFIX}${profile}::`);
}

export function clearTowerFactoryMeta(tower: string): void {
	if (typeof localStorage === "undefined") return;
	const suffix = `::${tower.trim().toLowerCase()}`;
	for (let i = localStorage.length - 1; i >= 0; i--) {
		const key = localStorage.key(i);
		if (
			key &&
			(key.startsWith(ACK_PREFIX) || key.startsWith(BASE_PREFIX)) &&
			key.endsWith(suffix)
		) {
			localStorage.removeItem(key);
		}
	}
}
