import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { defineConfig } from "vite";
import lucidePreprocess from "vite-plugin-lucide-preprocess";
import { towersPlugin } from "./src/lib/plugins";

export default defineConfig({
  plugins: [
    lucidePreprocess(),
    enhancedImages(),
    tailwindcss(),
    sveltekit(),
    towersPlugin(),
  ],
  server: {
    open: false,
  },
});
