import type { Picture } from "@sveltejs/enhanced-img";
import Exp from "./Exp";
import Money from "./Money";

export type WikiTemplate = {
	color: string;
	formatNumber: boolean;
	suffix?: string;
	icon?: Picture;
};

export const wikiTemplates: Record<string, WikiTemplate> = {
	Money,
	Exp,
};

export function wikiTemplateKey(name: string | undefined | null): string {
	if (!name) return "";
	let t = name.replace(/_/g, " ").replace(/ {2,}/g, " ").trim();
	// # parser function
	// : is a shorthand for main namespace
	if (!t || t.startsWith("#") || t.startsWith(":")) return "";
	t = t.replace(/^template\s*:\s*/i, "").trim();
	if (!t || t.startsWith("#")) return "";
	return t[0].toUpperCase() + t.slice(1);
}

export function wikiTemplate(name: string | undefined | null) {
	const key = wikiTemplateKey(name);
	return key ? wikiTemplates[key] : undefined;
}

export function formatsWikiNumber(name: string | undefined | null) {
	return wikiTemplate(name)?.formatNumber === true;
}
