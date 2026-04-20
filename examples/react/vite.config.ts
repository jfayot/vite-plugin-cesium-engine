import { defineConfig, PreviewServer } from "vite";
import react from "@vitejs/plugin-react";
// In real-world project, replace the next import with the following one
import { cesiumEngine } from "vite-plugin-cesium-engine";
// import { cesiumEngine } from "../../src/index.js";

export default defineConfig({
  plugins: [react(), cesiumEngine()],
  resolve: {
    conditions: ["development"]
  },
});
