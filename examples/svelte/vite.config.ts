import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cesiumEngine } from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [
    svelte(),
    cesiumEngine({
      ionToken: "YOUR-OWN-ION-TOKEN-HERE",
      debug: true,
    }),
  ],
});
