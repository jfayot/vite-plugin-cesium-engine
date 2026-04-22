import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "vite-plugin-cesium-engine",
      fileName: "vite-plugin-cesium-engine",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["node:fs", "node:path", "vite"],
    },
  },
});
