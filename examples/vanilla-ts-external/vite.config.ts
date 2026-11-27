import { defineConfig } from "vite";
import { cesiumEngine } from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [
    cesiumEngine({
      assets: "external",
      cesiumBaseUrl: "https://cdn.jsdelivr.net/npm/cesium@1.147.0/Build/Cesium",
      widgetCssUrl:
        "https://cdn.jsdelivr.net/npm/@cesium/engine@26.5.0/Source/Widget/CesiumWidget.css",
    }),
  ],
});
