import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts()],
  build: {
    // This is a Node plugin, not a browser bundle.
    target: "node18",
    lib: {
      entry: "./src/index.ts",
      name: "vite-plugin-cesium-engine",
      fileName: "vite-plugin-cesium-engine",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // Vite and its peers are provided by the consumer — never bundle them.
      external: ["vite", "vite-plugin-static-copy", "node:fs", "node:path"],
    },
  },
});
