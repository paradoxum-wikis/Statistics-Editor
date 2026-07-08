import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { towersPlugin } from "./src/lib/plugins";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), towersPlugin()],
  server: {
    open: false,
  },
});
