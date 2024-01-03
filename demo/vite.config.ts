import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesiumEngine from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [
    react(),
    cesiumEngine({
      cesiumEngineVersion: "^6.2.0",
      // ionToken: "YOUR_OWN_ION_ACCESS_TOKEN",
    }),
  ],
});
