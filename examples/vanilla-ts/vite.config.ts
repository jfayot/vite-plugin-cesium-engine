import { defineConfig } from "vite";
import { cesiumEngine } from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [
    cesiumEngine({
      ionToken: "YOUR-OWN-ION-TOKEN-HERE",
      debug: true,
    }),
  ],
});
