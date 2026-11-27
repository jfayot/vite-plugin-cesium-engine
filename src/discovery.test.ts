import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { build, createServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cesiumEngine } from "./index.ts";

let workspace: string;
let root: string;

beforeEach(() => {
  workspace = realpathSync(mkdtempSync(join(tmpdir(), "cesium-discovery-")));
  root = join(workspace, "packages/map app/src");
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify({
      private: true,
      workspaces: ["packages/*"],
    }),
  );
  writeFileSync(
    join(dirname(root), "package.json"),
    JSON.stringify({
      name: "map-app",
      type: "module",
    }),
  );
  writeFileSync(join(root, "index.html"), '<script type="module" src="/main.js"></script>');
  writeFileSync(
    join(root, "main.js"),
    `
    import { CESIUM_VERSION } from "virtual:cesium/version";
    document.body.dataset.version = CESIUM_VERSION;
  `,
  );
});

afterEach(() => rmSync(workspace, { recursive: true, force: true }));

function writeEngine(directory: string, version: string) {
  const files = {
    "package.json": JSON.stringify({ name: "@cesium/engine", version, main: "index.js" }),
    "index.js": "export {};",
    "Build/Workers/probe.js": `export const version = ${JSON.stringify(version)};`,
    "Source/Assets/version.json": JSON.stringify({ version }),
    "Source/Widget/CesiumWidget.css": ".cesium-widget { height: 100%; }",
  };
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), source);
  }
}

describe("automatic engine discovery", () => {
  it.each([
    "nested root",
    "npm hoisting",
    "pnpm symlinks",
    "relative override",
    "absolute override",
  ])("uses the correct package for %s in builds and development", async (layout) => {
    const hoisted = join(workspace, "node_modules/@cesium/engine");
    writeEngine(hoisted, "26.2.0");
    let expectedVersion = "26.5.0";
    let enginePath: string | undefined;
    if (layout === "nested root") {
      writeEngine(join(dirname(root), "node_modules/@cesium/engine"), expectedVersion);
    } else if (layout === "npm hoisting") {
      writeEngine(hoisted, expectedVersion);
    } else if (layout === "pnpm symlinks") {
      const stored = join(
        workspace,
        "node_modules/.pnpm/@cesium+engine@26.5.0/node_modules/@cesium/engine",
      );
      writeEngine(stored, expectedVersion);
      const link = join(dirname(root), "node_modules/@cesium/engine");
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(stored, link, "junction");
    } else {
      const vendor = join(workspace, "vendor/engine");
      expectedVersion = "99.0.0";
      writeEngine(vendor, expectedVersion);
      enginePath = layout === "relative override" ? relative(root, vendor) : vendor;
    }
    const config = { root, base: "/app/", configFile: false as const, logLevel: "silent" as const };
    const options = { enginePath, ionToken: "" };
    const result = await build({
      ...config,
      plugins: [cesiumEngine(options)],
      build: { minify: false },
    });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected a build output");
    const code = result.output
      .filter((file) => file.type === "chunk")
      .map((file) => file.code)
      .join("\n");
    expect(code).toContain(JSON.stringify(expectedVersion));
    expect(JSON.parse(readFileSync(join(root, "dist/cesium/Assets/version.json"), "utf8"))).toEqual(
      { version: expectedVersion },
    );

    const server = await createServer({
      ...config,
      plugins: [cesiumEngine(options)],
      server: { host: "127.0.0.1", port: 0 },
    });
    try {
      await server.listen();
      const address = server.httpServer!.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP server");
      const base = `http://127.0.0.1:${address.port}/app/cesium`;
      const asset = await fetch(`${base}/Assets/version.json`);
      expect(asset.status, asset.status === 200 ? "" : await asset.text()).toBe(200);
      expect(await asset.json()).toEqual({ version: expectedVersion });
      const worker = await fetch(`${base}/Workers/probe.js`);
      expect(worker.status).toBe(200);
      expect(await worker.text()).toContain(JSON.stringify(expectedVersion));
      const css = await fetch(`${base}/Widget/CesiumWidget.css`, {
        headers: { Accept: "text/css" },
      });
      expect(css.status).toBe(200);
      expect(await css.text()).toContain(".cesium-widget");
    } finally {
      await server.close();
    }
  });

  it("reports a missing engine instead of resolving the plugin's own dependency", async () => {
    await expect(
      build({ root, configFile: false, logLevel: "silent", plugins: [cesiumEngine()] }),
    ).rejects.toThrow("Could not find @cesium/engine");
  });
});
