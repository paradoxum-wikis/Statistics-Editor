import { towerNames } from "$lib/towerComponents/towers";

export const prerender = true;

export function GET() {
  const urls = [
    `	<url><loc>https://se.tds.wiki/</loc></url>`,
    `	<url><loc>https://se.tds.wiki/workshop</loc></url>`,
    ...towerNames.map((name) => {
      const url = `https://se.tds.wiki/tower/${encodeURIComponent(name)}`;
      return `	<url><loc>${url}</loc></url>`;
    }),
  ].join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
}
