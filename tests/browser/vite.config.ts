import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { cesiumEngine } from "../../src/index.ts";

export default defineConfig({
  root: fileURLToPath(new URL("./fixture", import.meta.url)),
  base: "/app/",
  plugins: [
    cesiumEngine({
      ionToken: "",
    }),
  ],
  server: { host: "127.0.0.1", strictPort: true },
  preview: { host: "127.0.0.1", strictPort: true },
});
