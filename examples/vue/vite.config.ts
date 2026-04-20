import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cesiumEngine } from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [vue(), cesiumEngine()],
  resolve: {
    conditions: ["development"]
  },
});
