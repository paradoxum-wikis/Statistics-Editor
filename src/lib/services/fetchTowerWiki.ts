export const noFetchTowers = new Set<string>();

export async function fetchTowerWiki(
  towerName: string,
  force: boolean = false,
): Promise<string | null> {
  if (!force && noFetchTowers.has(towerName)) return null;

  try {
    const parseRes = await fetch(
      `https://tds.fandom.com/api.php?action=parse&page=${encodeURIComponent(towerName)}&prop=sections&format=json&origin=*`,
    );
    const parseData = await parseRes.json();
    const sections = parseData?.parse?.sections;
    if (!sections) return null;

    const statsSection = sections.find((s: any) => s.anchor === "Stats_Table");
    if (!statsSection) return null;

    const queryRes = await fetch(
      `https://tds.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvsection=${statsSection.index}&titles=${encodeURIComponent(towerName)}&format=json&rvslots=main&origin=*`,
    );
    const queryData = await queryRes.json();
    const pages = queryData?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    const content = page?.revisions?.[0]?.slots?.main?.["*"];
    if (!content) return null;

    const nowikiMatch = content.match(
      /<nowiki>(?:\r?\n)?([\s\S]*?)<\/nowiki>/i,
    );
    if (nowikiMatch) {
      return nowikiMatch[1].trim();
    }
  } catch (err) {
    console.error(`Failed to fetch wikitext from wiki for ${towerName}:`, err);
  }

  return null;
}
