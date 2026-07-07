import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

function categoriesPlugin() {
  const virtualModuleId = "virtual:categories";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "categories",
    resolveId(id: string) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    async load(id: string) {
      if (id !== resolvedVirtualModuleId) return;
      const towersDirectory = `${process.cwd()}/src/lib/towerComponents/towers`;
      const glob = new Bun.Glob("*.wiki");
      const wikiFiles = Array.from(glob.scanSync({ cwd: towersDirectory }));

      const categoryEntries: [string, string][] = [];
      for (const file of wikiFiles) {
        const towerName = file.replace(/\.wiki$/, "");
        const fileContent = await Bun.file(`${towersDirectory}/${file}`).text();
        const match = fileContent.match(
          /\$FSE-CATEGORY\$\s*=\s*["']?([^"'\s;]+)/i,
        );
        if (match) {
          categoryEntries.push([towerName, match[1]]);
        }
      }
      return `export const categoryEntries = ${JSON.stringify(categoryEntries)};`;
    },
    configureServer(server: any) {
      const towersDirectory = `${process.cwd()}/src/lib/towerComponents/towers`;
      server.watcher.add(towersDirectory);
      server.watcher.on("change", (file: string) => {
        if (file.endsWith(".wiki")) {
          const module = server.moduleGraph.getModuleById(
            resolvedVirtualModuleId,
          );
          if (module) server.reloadModule(module);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), categoriesPlugin()],
  server: {
    open: false,
  },
});
