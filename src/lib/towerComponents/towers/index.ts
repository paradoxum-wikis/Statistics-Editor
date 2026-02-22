const wikiModules = import.meta.glob("./*.wiki", {
  eager: true,
  query: "?raw",
}) as Record<string, string>;

export const towerNames: string[] = Object.keys(wikiModules)
  .map((path) => path.slice(2, -5))
  .sort();
