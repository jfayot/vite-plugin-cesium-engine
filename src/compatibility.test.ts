import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build, createServer } from "vite";
import { describe, expect, it } from "vitest";
import { cesiumEngine } from "./index.ts";

const require = createRequire(import.meta.url);
const token = "eyJhbGciOiJIUzI1NiJ9.eyJzbW9rZSI6dHJ1ZX0.compatibility-test";
const assetPath = "vendor/cesium";

describe.each([
  { engine: "cesium-engine-legacy", split: false },
  { engine: "@cesium/engine", split: true },
])("compatibility with $engine", ({ engine, split }) => {
  it("builds, groups Cesium modules, injects the token, and serves runtime assets", async () => {
    const root = mkdtempSync(join(tmpdir(), "cesium-compatibility-"));
    const engineEntry = require.resolve(engine);
    const engineRoot = dirname(engineEntry);
    const { version } = JSON.parse(readFileSync(join(engineRoot, "package.json"), "utf8"));
    const options = {
      enginePath: engineRoot,
      assetsPath: assetPath,
      chunkName: "vendor-cesium",
      ionToken: token,
    };
    const config = {
      root,
      base: "/app/",
      configFile: false as const,
      logLevel: "silent" as const,
      resolve: {
        alias: {
          "@cesium/engine": engineEntry,
          "@cesium/core": require.resolve("@cesium/core"),
        },
      },
    };

    try {
      writeFileSync(join(root, "index.html"), '<script type="module" src="/entry.js"></script>');
      writeFileSync(
        join(root, "entry.js"),
        `
        import { CesiumWidget, Ion, buildModuleUrl } from "@cesium/engine";
        import { CESIUM_BASE_URL } from "virtual:cesium";
        import { CESIUM_VERSION } from "virtual:cesium/version";
        ${split ? 'import { Cartesian3 } from "@cesium/core";' : ""}
        globalThis.cesiumSmoke = {
          CesiumWidget, Ion, CESIUM_BASE_URL, CESIUM_VERSION,
          workerUrl: buildModuleUrl("Workers/createBoxGeometry.js"),
          ${split ? "position: Cartesian3.fromDegrees(-75.6, 40, 1500000)," : ""}
        };
      `,
      );
      const result = await build({
        ...config,
        plugins: [cesiumEngine(options)],
        build: { minify: false },
      });
      if (Array.isArray(result) || !("output" in result)) {
        throw new Error("Expected a single build output");
      }
      const chunks = result.output.filter((file) => file.type === "chunk");
      const vendor = chunks.find((chunk) => chunk.name === "vendor-cesium");
      expect(vendor).toBeDefined();
      expect(vendor!.code).toContain(JSON.stringify(token));
      const moduleIds = Object.keys(vendor!.modules).map((id) => id.replace(/\\/g, "/"));
      expect(moduleIds.some((id) => id.includes("/@cesium/engine/"))).toBe(true);
      for (const name of ["core", "gltf"]) {
        expect(moduleIds.some((id) => id.includes(`/@cesium/${name}/`))).toBe(split);
      }
      const bundledCode = chunks.map((chunk) => chunk.code).join("\n");
      expect(bundledCode).toContain(JSON.stringify(version));
      expect(bundledCode).toContain('"/app/vendor/cesium/"');
      expect(readFileSync(join(root, "dist/index.html"), "utf8")).toContain(
        'href="/app/vendor/cesium/Widget/CesiumWidget.css"',
      );

      const server = await createServer({
        ...config,
        plugins: [cesiumEngine(options)],
        server: {
          host: "127.0.0.1",
          port: 0,
          fs: { allow: [root, dirname(dirname(engineRoot))] },
        },
      });
      try {
        await server.listen();
        const address = server.httpServer!.address();
        if (!address || typeof address === "string") throw new Error("Expected a TCP server");
        for (const asset of [
          "Workers/createBoxGeometry.js",
          "ThirdParty/draco_decoder.wasm",
          "Assets/approximateTerrainHeights.json",
          "Widget/CesiumWidget.css",
        ]) {
          const builtAsset = readFileSync(join(root, "dist", assetPath, asset));
          expect(builtAsset.length).toBeGreaterThan(0);
          const response = await fetch(
            `http://127.0.0.1:${address.port}/app/${assetPath}/${asset}`,
            { headers: { Accept: asset.endsWith(".css") ? "text/css" : "*/*" } },
          );
          expect(response.status, asset).toBe(200);
          if (asset.endsWith(".js") || asset.endsWith(".css")) {
            expect(await response.text(), asset).toContain(
              asset.endsWith(".js") ? "createBoxGeometry" : ".cesium-widget",
            );
          } else {
            expect(Buffer.from(await response.arrayBuffer()).equals(builtAsset), asset).toBe(true);
          }
        }
      } finally {
        await server.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
