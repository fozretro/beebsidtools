import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Local `./app` stays at `/`. GitHub Pages sets BASE_PATH=/beebsidtools/
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: {
      buffer: require.resolve("buffer/"),
      assert: join(HERE, "src/shims/assert.js"),
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    // Keep create source out of the prebundle so edits (e.g. pipeline) apply without stale cache.
    include: ["buffer"],
    exclude: ["jsbeeb", "beebsidtools-src-create"],
  },
  server: {
    port: 5173,
    fs: {
      // Allow serving / importing vendored FastSID + jsbeeb from create package
      allow: [
        HERE,
        join(HERE, "../src.create"),
        join(HERE, "../src.player"),
      ],
    },
  },
  build: {
    target: "esnext",
    commonjsOptions: {
      include: [/jsbeeb/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
});
