import { defineConfig, PreviewServer } from "vite";
import react from "@vitejs/plugin-react";
import { cesiumEngine } from "vite-plugin-cesium-engine";
import cspHashes from "./csp-hashes.json";

export function previewWithCspPlugin() {
  return {
    name: "configure-preview-server",
    configurePreviewServer(server: PreviewServer) {
      return () => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader(
            "Content-Security-Policy",
            // If you try without the csp hashes, you'll get the Content-Security-Policy error
            // "script-src 'self'",
            `script-src 'self' 'wasm-unsafe-eval' ${cspHashes.scriptHashes.join(" ")}`,
          );
          next();
        });
      };
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    cesiumEngine({
      debug: true,
      cspHashesOutput: "csp-hashes.json",
    }),
    previewWithCspPlugin(),
  ],
});
