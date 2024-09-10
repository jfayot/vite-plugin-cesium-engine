import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesiumEngine from "vite-plugin-cesium-engine";

export default defineConfig({
  base: "/prefix",
  plugins: [
    react(),
    cesiumEngine({
      // ionToken: "YOUR_OWN_ION_ACCESS_TOKEN",
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) return "react";
            if (id.includes("@cesium/engine")) return "cesium_engine";
            return "vendor";
          }
        },
      },
    },
  },
});
