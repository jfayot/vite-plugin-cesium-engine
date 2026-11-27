import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build, type InlineConfig } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cesiumEngine, type CesiumEngineOptions, type IonTokenConfig } from "./index.ts";

const require = createRequire(import.meta.url);
const enginePath = dirname(require.resolve("@cesium/engine"));
const fileToken = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2UiOiJmaWxlIn0.file-token";
const overrideToken = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2UiOiJvdmVycmlkZSJ9.override-token";
let root: string;

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CESIUM_ION_TOKEN")) vi.stubEnv(key, undefined);
  }
  root = mkdtempSync(join(tmpdir(), "cesium-env-"));
  writeFileSync(join(root, "entry.js"), 'export { ION_TOKEN } from "virtual:cesium";');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

async function buildSource(options: CesiumEngineOptions = {}, config: InlineConfig = {}) {
  const result = await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [
      cesiumEngine({
        assets: "external",
        cesiumBaseUrl: "https://assets.example.test/cesium",
        enginePath,
        ...options,
      }),
    ],
    build: {
      write: false,
      minify: false,
      lib: { entry: join(root, "entry.js"), formats: ["es"] },
    },
    ...config,
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!("output" in bundle)) {
    throw new Error("Expected a build output");
  }
  return bundle.output
    .filter((file) => file.type === "chunk")
    .map((file) => file.code)
    .join("\n");
}

describe("Ion token loading with real Vite builds", () => {
  it.each(["development", "production", "staging"])("loads .env in %s mode", async (mode) => {
    writeFileSync(join(root, ".env"), `CESIUM_ION_TOKEN=${fileToken}\n`);
    expect(await buildSource({}, { mode })).toContain(JSON.stringify(fileToken));
  });

  it.each([".env.local", ".env.production", ".env.production.local"])(
    "respects Vite's file precedence for %s",
    async (file) => {
      writeFileSync(join(root, ".env"), `CESIUM_ION_TOKEN=${fileToken}\n`);
      writeFileSync(join(root, file), `CESIUM_ION_TOKEN=${overrideToken}\n`);
      expect(await buildSource()).toContain(JSON.stringify(overrideToken));
    },
  );

  it("loads mode-specific variables from a custom envDir relative to root", async () => {
    mkdirSync(join(root, "config"));
    writeFileSync(join(root, ".env"), `CESIUM_ION_TOKEN_STAGING=${fileToken}\n`);
    writeFileSync(join(root, "config/.env"), `CESIUM_ION_TOKEN=${fileToken}\n`);
    writeFileSync(join(root, "config/.env.staging"), `CESIUM_ION_TOKEN_STAGING=${overrideToken}\n`);
    expect(await buildSource({}, { mode: "staging", envDir: "config" })).toContain(
      JSON.stringify(overrideToken),
    );
  });

  it.each(["CESIUM_ION_TOKEN", "CESIUM_ION_TOKEN_PRODUCTION"])(
    "prefers the shell value of %s over its file value",
    async (key) => {
      writeFileSync(join(root, ".env"), `${key}=${fileToken}\n`);
      vi.stubEnv(key, overrideToken);
      expect(await buildSource()).toContain(JSON.stringify(overrideToken));
    },
  );

  it.each<{ name: string; ionToken: IonTokenConfig; expected: string | null }>([
    { name: "string", ionToken: overrideToken, expected: overrideToken },
    { name: "mode map", ionToken: { production: overrideToken }, expected: overrideToken },
    { name: "callback", ionToken: () => overrideToken, expected: overrideToken },
    { name: "async callback", ionToken: async () => overrideToken, expected: overrideToken },
    { name: "empty string", ionToken: "", expected: null },
    { name: "empty map", ionToken: {}, expected: null },
  ])("preserves the explicit $name option over env variables", async ({ ionToken, expected }) => {
    writeFileSync(join(root, ".env"), `CESIUM_ION_TOKEN=${fileToken}\n`);
    vi.stubEnv("CESIUM_ION_TOKEN_PRODUCTION", fileToken);
    const source = await buildSource({ ionToken });
    expect(source).toContain(`ION_TOKEN = ${JSON.stringify(expected)}`);
    expect(source).not.toContain(fileToken);
  });

  it.each([undefined, overrideToken])(
    "respects envDir: false with shell token %s",
    async (token) => {
      writeFileSync(join(root, ".env"), `CESIUM_ION_TOKEN=${fileToken}\n`);
      vi.stubEnv("CESIUM_ION_TOKEN", token);
      expect(await buildSource({}, { envDir: false })).toContain(
        `ION_TOKEN = ${JSON.stringify(token ?? null)}`,
      );
    },
  );

  it("exports null when no token is configured", async () => {
    expect(await buildSource()).toContain("ION_TOKEN = null");
  });
});
