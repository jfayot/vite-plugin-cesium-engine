import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "vite-plugin-cesium-engine",
      fileName: "vite-plugin-cesium-engine",
    },
    rollupOptions: {
      external: ["vite-plugin-static-copy"],
      output: {
        globals: {
          "vite-plugin-static-copy": "vitePluginStaticCopy",
        },
      },
    },
  },
});
