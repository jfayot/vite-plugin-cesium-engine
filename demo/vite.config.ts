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
});
