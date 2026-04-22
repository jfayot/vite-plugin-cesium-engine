/**
 * Unit tests for vite-plugin-cesium-engine
 *
 * Strategy
 * ─────────
 * The plugin is a pure function that returns a Vite Plugin object. We unit-test
 * it by:
 *   1. Mocking `node:fs` and `node:path` so nothing touches the real disk.
 *   2. Calling the plugin factory and invoking each hook directly (config,
 *      configResolved, load, resolveId, transform, transformIndexHtml,
 *      closeBundle).
 *   3. Asserting on return values and side-effects (console.warn/log calls).
 *
 * The configureServer hook is integration-level and is covered by a smoke test
 * only (verifying the middleware is registered without spinning up a real server).
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

// ─── Mock node:fs ─────────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  cpSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  copyFileSync: vi.fn(),
  readFileSync: vi.fn(() => JSON.stringify({ version: "23.0.1" })),
}));

// ─── Mock node:path (use real logic but spy on it) ────────────────────────────
// We keep real path behavior so path.join / path.resolve work naturally.
import * as nodePath from "node:path";
vi.mock("node:path", async () => {
  const real = await vi.importActual<typeof nodePath>("node:path");
  return { ...real };
});

// ─── Imports after mocks are set up ──────────────────────────────────────────
import * as fs from "node:fs";
import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";

// ─── Types re-used across tests ───────────────────────────────────────────────
type PluginWithHooks = Plugin & {
  config: (cfg: Partial<UserConfig>) => Partial<UserConfig> | undefined;
  configResolved: (cfg: Partial<ResolvedConfig>) => void;
  resolveId: (id: string) => string | undefined;
  load: (id: string) => string | undefined;
  transform: (code: string, id: string) => string | undefined;
  transformIndexHtml: () => Array<{
    tag: string;
    injectTo: string;
    attrs: Record<string, string>;
  }>;
  closeBundle: () => void;
  configureServer: (server: Partial<ViteDevServer>) => void;
};

// ─── Helper: build a minimal ResolvedConfig ────────────────────────────────
function makeResolvedConfig(
  overrides: Partial<ResolvedConfig> = {},
): Partial<ResolvedConfig> {
  return {
    mode: "production",
    command: "build",
    base: "/",
    build: { outDir: "dist" } as ResolvedConfig["build"],
    ...overrides,
  };
}

// ─── Helper: build and configure a plugin ─────────────────────────────────
async function buildPlugin(
  options: Parameters<typeof import("./index.js").cesiumEngine>[0] = {},
  resolvedCfgOverrides: Partial<ResolvedConfig> = {},
): Promise<PluginWithHooks> {
  const { cesiumEngine } = await import("./index.js");
  const plugin = cesiumEngine(options) as unknown as PluginWithHooks;

  // Run config hook so internal URL is set.
  const userConfig: Partial<UserConfig> = { base: "/" };
  plugin.config(userConfig);

  // Run configResolved hook.
  const resolvedConfig = makeResolvedConfig(resolvedCfgOverrides);
  plugin.configResolved(resolvedConfig as ResolvedConfig);

  return plugin;
}

// ─── Setup & teardown ────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetModules();

  // Re-apply defaults after resetModules clears the mock state.
  vi.mocked(fs.existsSync).mockImplementation((p) =>
    String(p).includes("@cesium"),
  );
  vi.mocked(fs.readFileSync).mockReturnValue(
    JSON.stringify({ version: "23.0.1" }),
  );
  vi.mocked(fs.readdirSync).mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. Plugin factory
// ═════════════════════════════════════════════════════════════════════════════

describe("cesiumEngine()", () => {
  it("returns a plugin named 'vite-plugin-cesium-engine'", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine();
    expect(plugin.name).toBe("vite-plugin-cesium-engine");
  });

  it("sets enforce: 'pre'", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine();
    expect(plugin.enforce).toBe("pre");
  });

  it("throws when @cesium/engine is not installed", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { cesiumEngine } = await import("./index.js");
    expect(() => cesiumEngine()).toThrow(/@cesium\/engine/);
  });

  it("falls back to 'unknown' version when package.json cannot be read", async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine() as unknown as PluginWithHooks;
    plugin.config({});
    plugin.configResolved(makeResolvedConfig() as ResolvedConfig);
    const versionSrc = plugin.load("\0virtual:cesium/version");
    expect(versionSrc).toContain("unknown");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. config hook
// ═════════════════════════════════════════════════════════════════════════════

describe("config hook", () => {
  it("injects CESIUM_BASE_URL define with default path /cesium/", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine() as unknown as PluginWithHooks;
    const result = plugin.config({ base: "/" });
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/cesium/"');
  });

  it("respects explicit cesiumBaseUrl option", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      cesiumBaseUrl: "/static/cesium",
    }) as unknown as PluginWithHooks;
    const result = plugin.config({ base: "/" });
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/static/cesium/"');
  });

  it("strips a single trailing slash from cesiumBaseUrl", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      cesiumBaseUrl: "/static/cesium/",
    }) as unknown as PluginWithHooks;
    const result = plugin.config({});
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/static/cesium/"');
  });

  it("strips multiple trailing slashes from cesiumBaseUrl", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      cesiumBaseUrl: "/static/cesium///",
    }) as unknown as PluginWithHooks;
    const result = plugin.config({});
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/static/cesium/"');
  });

  it("uses assetsPath to compose default CESIUM_BASE_URL", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      assetsPath: "assets/cesium",
    }) as unknown as PluginWithHooks;
    const result = plugin.config({ base: "/" });
    // default base + assetsPath
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/assets/cesium/"');
  });

  it("incorporates Vite base into default CESIUM_BASE_URL", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine() as unknown as PluginWithHooks;
    const result = plugin.config({ base: "/app/" });
    // base trailing slash stripped then /cesium appended
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/app/cesium/"');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. configResolved hook
// ═════════════════════════════════════════════════════════════════════════════

describe("configResolved hook", () => {
  it("emits a warning when cesiumBaseUrl does not start with Vite base", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      cesiumBaseUrl: "/cdn/cesium",
    }) as unknown as PluginWithHooks;
    plugin.config({ base: "/app" });
    plugin.configResolved(
      makeResolvedConfig({ base: "/app" }) as ResolvedConfig,
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("does not start with Vite's base"),
    );
    warnSpy.mockRestore();
  });

  it("does NOT warn when cesiumBaseUrl starts with Vite base", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      cesiumBaseUrl: "/app/cesium",
    }) as unknown as PluginWithHooks;
    plugin.config({ base: "/app" });
    plugin.configResolved(
      makeResolvedConfig({ base: "/app" }) as ResolvedConfig,
    );
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("emits debug logs when debug: true", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({ debug: true }) as unknown as PluginWithHooks;
    plugin.config({});
    plugin.configResolved(makeResolvedConfig() as ResolvedConfig);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("does NOT emit logs when debug: false", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({ debug: false }) as unknown as PluginWithHooks;
    plugin.config({});
    plugin.configResolved(makeResolvedConfig() as ResolvedConfig);
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Ion token resolution
// ═════════════════════════════════════════════════════════════════════════════

// A valid-looking JWT for testing purposes.
const FAKE_JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("Ion token resolution", () => {
  it("resolves a string token for all modes", async () => {
    const plugin = await buildPlugin({ ionToken: FAKE_JWT });
    const src = plugin.load("\0virtual:cesium");
    expect(src).toContain(FAKE_JWT);
  });

  it("resolves mode-specific token from a map", async () => {
    const plugin = await buildPlugin(
      {
        ionToken: {
          production: FAKE_JWT,
          development: "eyJhbGciOiJIUzI1NiJ9.eyJkZXYiOnRydWV9.abc123",
        },
      },
      { mode: "production" },
    );
    const src = plugin.load("\0virtual:cesium");
    expect(src).toContain(FAKE_JWT);
  });

  it("falls back to 'default' key when mode is not in the map", async () => {
    const defaultToken = "eyJhbGciOiJIUzI1NiJ9.eyJkZWZhdWx0Ijp0cnVlfQ.xyz789";
    const plugin = await buildPlugin(
      {
        ionToken: { default: defaultToken },
      },
      { mode: "staging" },
    );
    const src = plugin.load("\0virtual:cesium");
    expect(src).toContain(defaultToken);
  });

  it("emits ION_TOKEN = null when ionToken is omitted", async () => {
    const plugin = await buildPlugin();
    const src = plugin.load("\0virtual:cesium");
    expect(src).toContain("ION_TOKEN = null");
  });

  it("warns when token does not look like a JWT", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await buildPlugin({ ionToken: "not-a-jwt" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("does not look like a valid Cesium Ion JWT"),
    );
    warnSpy.mockRestore();
  });

  it("does NOT warn for a valid JWT-shaped token", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await buildPlugin({ ionToken: FAKE_JWT });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. resolveId hook
// ═════════════════════════════════════════════════════════════════════════════

describe("resolveId hook", () => {
  it("resolves virtual:cesium to \\0virtual:cesium", async () => {
    const plugin = await buildPlugin();
    expect(plugin.resolveId("virtual:cesium")).toBe("\0virtual:cesium");
  });

  it("resolves virtual:cesium/version to \\0virtual:cesium/version", async () => {
    const plugin = await buildPlugin();
    expect(plugin.resolveId("virtual:cesium/version")).toBe(
      "\0virtual:cesium/version",
    );
  });

  it("returns undefined for unknown ids", async () => {
    const plugin = await buildPlugin();
    expect(plugin.resolveId("some-other-module")).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. load hook
// ═════════════════════════════════════════════════════════════════════════════

describe("load hook — virtual:cesium", () => {
  it("exports CESIUM_BASE_URL ending with /", async () => {
    const plugin = await buildPlugin();
    const src = plugin.load("\0virtual:cesium")!;
    expect(src).toMatch(/export const CESIUM_BASE_URL = ".*\/"/);
  });

  it("exports ION_TOKEN as null when no token is configured", async () => {
    const plugin = await buildPlugin();
    const src = plugin.load("\0virtual:cesium")!;
    expect(src).toContain("export const ION_TOKEN = null");
  });

  it("exports ION_TOKEN as a string when token is configured", async () => {
    const plugin = await buildPlugin({ ionToken: FAKE_JWT });
    const src = plugin.load("\0virtual:cesium")!;
    expect(src).toContain(`export const ION_TOKEN = "${FAKE_JWT}"`);
  });

  it("CESIUM_BASE_URL in virtual module matches the define value", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      cesiumBaseUrl: "/my/cesium",
    }) as unknown as PluginWithHooks;
    const defineCfg = plugin.config({ base: "/" });
    plugin.configResolved(makeResolvedConfig() as ResolvedConfig);

    const defineVal = defineCfg?.define?.["CESIUM_BASE_URL"]; // e.g. '"/my/cesium/"'
    const virtualSrc = plugin.load("\0virtual:cesium")!;
    // Both should expose the same URL (strip outer quotes from the define string).
    const defineUrl = defineVal?.replace(/^"|"$/g, "");
    expect(virtualSrc).toContain(
      `export const CESIUM_BASE_URL = "${defineUrl}"`,
    );
  });

  it("returns undefined for unknown resolved ids", async () => {
    const plugin = await buildPlugin();
    expect(plugin.load("\0some-other")).toBeUndefined();
  });
});

describe("load hook — virtual:cesium/version", () => {
  it("exports CESIUM_VERSION as the installed package version", async () => {
    const plugin = await buildPlugin();
    const src = plugin.load("\0virtual:cesium/version")!;
    expect(src).toContain('export const CESIUM_VERSION = "23.0.1"');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. transform hook (Ion token injection)
// ═════════════════════════════════════════════════════════════════════════════

describe("transform hook", () => {
  const ionModuleIds = [
    "/path/to/node_modules/@cesium/engine/Source/Core/Ion.js",
    "@cesium/engine/Source/Core/Ion.js",
    "chunk-@cesium_engine.js",
  ];

  for (const id of ionModuleIds) {
    it(`injects token into Ion module: ${id}`, async () => {
      const plugin = await buildPlugin({ ionToken: FAKE_JWT });
      const code = `Ion.defaultAccessToken = defaultAccessToken`;
      const result = plugin.transform(code, id);
      expect(result).toContain(`Ion.defaultAccessToken = "${FAKE_JWT}"`);
    });
  }

  it("handles the $1 suffix variant (Vite scope rewriting)", async () => {
    const plugin = await buildPlugin({ ionToken: FAKE_JWT });
    const code = `Ion.defaultAccessToken = defaultAccessToken$1`;
    const result = plugin.transform(
      code,
      "/node_modules/@cesium/engine/Source/Core/Ion.js",
    );
    expect(result).toContain(`Ion.defaultAccessToken = "${FAKE_JWT}"`);
    expect(result).not.toContain("defaultAccessToken$1");
  });

  it("returns undefined when no ionToken is configured", async () => {
    const plugin = await buildPlugin();
    const code = `Ion.defaultAccessToken = defaultAccessToken`;
    const result = plugin.transform(code, "@cesium/engine/Source/Core/Ion.js");
    expect(result).toBeUndefined();
  });

  it("returns undefined for non-Ion modules", async () => {
    const plugin = await buildPlugin({ ionToken: FAKE_JWT });
    const result = plugin.transform("any code", "/src/main.ts");
    expect(result).toBeUndefined();
  });

  it("emits a warning when the replacement pattern is not found", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugin = await buildPlugin({ ionToken: FAKE_JWT });
    // Ion module detected but the token assignment line is absent.
    plugin.transform(
      "// no token line here",
      "@cesium/engine/Source/Core/Ion.js",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Ion token: pattern not found"),
    );
    warnSpy.mockRestore();
  });

  it("does not emit debug log when debug: false, even on successful injection", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const plugin = await buildPlugin({ ionToken: FAKE_JWT, debug: false });
    plugin.transform(
      "Ion.defaultAccessToken = defaultAccessToken",
      "@cesium/engine/Source/Core/Ion.js",
    );
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("emits a debug log on successful injection when debug: true", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const plugin = await buildPlugin({ ionToken: FAKE_JWT, debug: true });
    // configResolved already logged; reset to only capture transform logs.
    logSpy.mockClear();
    plugin.transform(
      "Ion.defaultAccessToken = defaultAccessToken",
      "@cesium/engine/Source/Core/Ion.js",
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Ion token injected"),
    );
    logSpy.mockRestore();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. transformIndexHtml hook
// ═════════════════════════════════════════════════════════════════════════════

describe("transformIndexHtml hook", () => {
  it("injects a <link> tag for CesiumWidget.css", async () => {
    const plugin = await buildPlugin();
    const tags = plugin.transformIndexHtml();
    expect(tags).toHaveLength(1);
    expect(tags[0].tag).toBe("link");
    expect(tags[0].attrs["rel"]).toBe("stylesheet");
    expect(tags[0].attrs["href"]).toContain("CesiumWidget.css");
  });

  it("injects into <head>", async () => {
    const plugin = await buildPlugin();
    const [tag] = plugin.transformIndexHtml();
    expect(tag.injectTo).toBe("head");
  });

  it("CSS href reflects cesiumBaseUrl option", async () => {
    const plugin = await buildPlugin({ cesiumBaseUrl: "/static/cesium" });
    const [tag] = plugin.transformIndexHtml();
    expect(tag.attrs["href"]).toBe("/static/cesium/Widget/CesiumWidget.css");
  });

  it("CSS href reflects custom assetsPath", async () => {
    const plugin = await buildPlugin({ assetsPath: "my-cesium" });
    const [tag] = plugin.transformIndexHtml();
    expect(tag.attrs["href"]).toContain("/my-cesium/Widget/CesiumWidget.css");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. closeBundle hook (asset copying)
// ═════════════════════════════════════════════════════════════════════════════

describe("closeBundle hook", () => {
  it("copies Cesium assets when command is 'build'", async () => {
    const plugin = await buildPlugin({}, { command: "build" });
    plugin.closeBundle();
    // cpSync is used for directory copies; mkdirSync for leaf dirs.
    expect(
      vi.mocked(fs.cpSync).mock.calls.length +
        vi.mocked(fs.mkdirSync).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("does NOT copy assets when command is 'serve'", async () => {
    const plugin = await buildPlugin({}, { command: "serve" });
    plugin.closeBundle();
    expect(vi.mocked(fs.cpSync)).not.toHaveBeenCalled();
    expect(vi.mocked(fs.mkdirSync)).not.toHaveBeenCalled();
  });

  it("uses assetsPath option when copying", async () => {
    const plugin = await buildPlugin(
      { assetsPath: "public/cesium" },
      { command: "build" },
    );
    plugin.closeBundle();
    // At least one cpSync call should reference our assetsPath.
    const destArgs = vi
      .mocked(fs.cpSync)
      .mock.calls.map(([, dest]) => String(dest));
    const mkdirArgs = vi
      .mocked(fs.mkdirSync)
      .mock.calls.map(([p]) => String(p));
    const allDest = [...destArgs, ...mkdirArgs];
    expect(allDest.some((d) => d.includes("public/cesium"))).toBe(true);
  });

  it("emits debug logs for each copy operation when debug: true", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const plugin = await buildPlugin({ debug: true }, { command: "build" });
    logSpy.mockClear(); // ignore configResolved logs
    plugin.closeBundle();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("copying:"));
    logSpy.mockRestore();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. configureServer hook (smoke test)
// ═════════════════════════════════════════════════════════════════════════════

describe("configureServer hook", () => {
  it("registers a middleware on the dev server", async () => {
    const plugin = await buildPlugin();
    const useSpy = vi.fn();
    const fakeServer = {
      middlewares: { use: useSpy },
    } as unknown as ViteDevServer;
    plugin.configureServer(fakeServer);
    expect(useSpy).toHaveBeenCalledOnce();
    expect(typeof useSpy.mock.calls[0][0]).toBe("function");
  });

  it("middleware calls next() for unmatched URLs", async () => {
    const plugin = await buildPlugin();
    let registeredMiddleware!: (
      req: { url?: string },
      res: unknown,
      next: () => void,
    ) => void;
    const fakeServer = {
      middlewares: {
        use: (fn: typeof registeredMiddleware) => {
          registeredMiddleware = fn;
        },
      },
    } as unknown as ViteDevServer;
    plugin.configureServer(fakeServer);

    const next = vi.fn();
    registeredMiddleware({ url: "/some/unrelated/path" }, {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("middleware rewrites URL for matched asset paths", async () => {
    // Make existsSync return true for the resolved file path.
    vi.mocked(fs.existsSync).mockImplementation(() => true);

    const plugin = await buildPlugin({ assetsPath: "cesium" });
    let registeredMiddleware!: (
      req: { url?: string },
      res: unknown,
      next: () => void,
    ) => void;
    const fakeServer = {
      middlewares: {
        use: (fn: typeof registeredMiddleware) => {
          registeredMiddleware = fn;
        },
      },
    } as unknown as ViteDevServer;
    plugin.configureServer(fakeServer);

    const req = { url: "/cesium/Assets/some-asset.png" };
    const next = vi.fn();
    registeredMiddleware(req, {}, next);
    // URL should have been rewritten to /@fs/…
    expect(req.url).toMatch(/^\/@fs\//);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. Edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe("edge cases", () => {
  it("cesiumBaseUrl without leading slash is normalized correctly", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine({
      cesiumBaseUrl: "static/cesium",
    }) as unknown as PluginWithHooks;
    const result = plugin.config({});
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/static/cesium/"');
  });

  it("empty base string is handled gracefully", async () => {
    const { cesiumEngine } = await import("./index.js");
    const plugin = cesiumEngine() as unknown as PluginWithHooks;
    const result = plugin.config({ base: "" });
    expect(result?.define?.["CESIUM_BASE_URL"]).toBe('"/cesium/"');
  });

  it("Windows-style Ion module path is detected", async () => {
    const plugin = await buildPlugin({ ionToken: FAKE_JWT });
    const winId =
      "C:\\project\\node_modules\\@cesium\\engine\\Source\\Core\\Ion.js";
    const result = plugin.transform(
      "Ion.defaultAccessToken = defaultAccessToken",
      winId,
    );
    expect(result).toContain(`Ion.defaultAccessToken = "${FAKE_JWT}"`);
  });
});
