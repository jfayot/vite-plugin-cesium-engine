import {
  existsSync,
  cpSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Ion access token configuration.
 *
 * Supply a single string to use the same token in every environment, or an
 * object to select a token based on the current Vite `mode`
 * (e.g. `"development"`, `"staging"`, `"production"`).
 *
 * @example single token
 * ```ts
 * ionToken: "eyJhbGci..."
 * ```
 *
 * @example per-environment tokens
 * ```ts
 * ionToken: {
 *   development: "eyJhbGci...",   // local dev token (lower quota)
 *   production:  "eyJhbGci...",   // production token
 * }
 * ```
 */
export type IonTokenConfig = string | Record<string, string>;

export type CesiumEngineOptions = {
  /**
   * Cesium Ion default access token, baked in at build time.
   * Accepts a plain string or a `{ [mode]: token }` map for per-environment
   * tokens (Vite `mode` is used as the key).
   *
   * When omitted, Cesium's built-in default token is used.
   *
   * @see https://ion.cesium.com/tokens
   * @default undefined
   */
  ionToken?: IonTokenConfig;

  /**
   * URL path under which Cesium's static assets will be served.
   * Must start with `/` and should match the `dest` folder used for copying.
   *
   * Useful when deploying to a CDN sub-path or a monorepo with a custom
   * public base.
   *
   * @default "/cesium"
   */
  cesiumBaseUrl?: string;

  /**
   * Output folder (relative to Vite's `build.outDir`) where Cesium's static
   * assets are copied during build.
   *
   * Change this when your deployment expects assets under a custom path, e.g.
   * `"public/cesium"` for a Laravel/Rails project.
   *
   * @default "cesium"
   */
  assetsPath?: string;

  /**
   * Emit debug logs showing which files are copied and which Ion token
   * (if any) is injected. Logs are prefixed with `[cesium-engine]`.
   *
   * @default false
   */
  debug?: boolean;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Detect the Ion module by plain substring checks. The ID can take three forms:
//
//   dev   (absolute path) : /…/node_modules/@cesium/engine/Source/Core/Ion.js
//   build (bare source)   : @cesium/engine/Source/Core/Ion.js
//   build (bundled)       : …@cesium_engine.js…
function isIonModule(id: string): boolean {
  return (
    id.includes("@cesium/engine/Source/Core/Ion.js") ||
    id.includes("@cesium\\engine\\Source\\Core\\Ion.js") ||
    id.includes("@cesium_engine.js")
  );
}

// Cesium Ion tokens are JWTs — a rough but useful sanity check.
const ION_TOKEN_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function log(message: string): void {
  console.log(`\x1b[36m[cesium-engine]\x1b[0m ${message}`);
}

function warn(message: string): void {
  console.warn(`\x1b[33m[cesium-engine]\x1b[0m ${message}`);
}

function resolveToken(
  tokenConfig: IonTokenConfig | undefined,
  mode: string,
): string | undefined {
  if (tokenConfig === undefined) return undefined;
  if (typeof tokenConfig === "string") return tokenConfig;
  return tokenConfig[mode] ?? tokenConfig["default"];
}

function validateToken(token: string, mode: string): void {
  if (!ION_TOKEN_RE.test(token)) {
    warn(
      `ionToken for mode "${mode}" does not look like a valid Cesium Ion JWT. ` +
        `Double-check the value at https://ion.cesium.com/tokens`,
    );
  }
}

function normalizePath(raw: string): string {
  // Strip trailing slash, ensure leading slash.
  return "/" + raw.replace(/^\/|\/$/g, "");
}

/**
 * Copy all files with a given extension from `srcDir` into `destDir`.
 * Non-recursive — only top-level files are matched.
 */
function copyByExtension(srcDir: string, destDir: string, ext: string): void {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(ext)) {
      copyFileSync(join(srcDir, entry.name), join(destDir, entry.name));
    }
  }
}

/**
 * Recursively copy `src` into `dest`. Equivalent to `cp -r src/* dest/`.
 */
function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true, force: true });
}

/**
 * Copy all Cesium static assets from `engineRoot` into `outDir/assetsPath`.
 * Called once after `vite build` finishes writing output.
 */
function copyCesiumAssets(
  engineRoot: string,
  outDir: string,
  assetsPath: string,
  debug: boolean,
): void {
  const dest = resolve(outDir, assetsPath);

  const copies: Array<{ label: string; fn: () => void }> = [
    {
      label: `ThirdParty/*.wasm → ${assetsPath}/ThirdParty`,
      fn: () =>
        copyByExtension(
          join(engineRoot, "Source/ThirdParty"),
          join(dest, "ThirdParty"),
          ".wasm",
        ),
    },
    {
      label: `Build/* → ${assetsPath}`,
      fn: () => copyDir(join(engineRoot, "Build"), dest),
    },
    {
      label: `Source/Assets/ → ${assetsPath}/Assets`,
      fn: () =>
        copyDir(join(engineRoot, "Source/Assets"), join(dest, "Assets")),
    },
    {
      label: `Widget/*.css → ${assetsPath}/Widget`,
      fn: () =>
        copyByExtension(
          join(engineRoot, "Source/Widget"),
          join(dest, "Widget"),
          ".css",
        ),
    },
  ];

  for (const { label, fn } of copies) {
    if (debug) log(`copying: ${label}`);
    fn();
  }
}

// ─── Virtual module: `virtual:cesium` ────────────────────────────────────────

const VIRTUAL_MODULE_ID = "virtual:cesium";
const RESOLVED_VIRTUAL_ID = "\0virtual:cesium";

// ─── Plugin factory ───────────────────────────────────────────────────────────

export function cesiumEngine(options: CesiumEngineOptions = {}): Plugin {
  const {
    ionToken: ionTokenConfig,
    cesiumBaseUrl: cesiumBaseUrlOption,
    assetsPath = "cesium",
    debug = false,
  } = options;

  let activeToken: string | undefined;
  // Final URL exposed to the browser (and to `virtual:cesium`).
  let cesiumBaseUrl: string;
  let resolvedConfig: ResolvedConfig;

  // ── Peer dependency check ───────────────────────────────────────────────────
  const engineRoot = resolve(process.cwd(), "node_modules/@cesium/engine");
  if (!existsSync(engineRoot)) {
    throw new Error(
      "[cesium-engine] Could not find @cesium/engine in node_modules.\n" +
        "Install it as a dependency:\n\n" +
        "  npm i @cesium/engine\n" +
        "  # or: pnpm add @cesium/engine\n",
    );
  }

  return {
    name: "vite-plugin-cesium-engine",
    enforce: "pre",

    // ── configResolved: derive all runtime values once ────────────────────
    configResolved(cfg) {
      resolvedConfig = cfg;
      const { mode } = cfg;

      // Resolve Ion token for this mode.
      activeToken = resolveToken(ionTokenConfig, mode);
      if (activeToken !== undefined) {
        validateToken(activeToken, mode);
      }

      // Build CESIUM_BASE_URL: explicit option wins, then derive from Vite base.
      const viteBase = (cfg.base ?? "").replace(/\/$/, "");
      cesiumBaseUrl = cesiumBaseUrlOption
        ? normalizePath(cesiumBaseUrlOption)
        : `${viteBase}/${assetsPath}`;

      // Warn when Vite's base and an explicit cesiumBaseUrl look inconsistent.
      if (
        cesiumBaseUrlOption &&
        viteBase &&
        !cesiumBaseUrl.startsWith(viteBase)
      ) {
        warn(
          `cesiumBaseUrl ("${cesiumBaseUrl}") does not start with Vite's ` +
            `base ("${viteBase}"). Assets may not resolve correctly.`,
        );
      }

      if (debug) {
        log(`mode         : ${mode}`);
        log(`vite base    : "${viteBase || "(empty)"}"`);
        log(`cesiumBaseUrl: "${cesiumBaseUrl}"`);
        log(`assetsPath   : "${assetsPath}"`);
        log(
          `ionToken     : ${
            activeToken
              ? `${activeToken.slice(0, 12)}… (mode: ${mode})`
              : "none (using Cesium default)"
          }`,
        );
      }
    },

    // ── Dev server: serve Cesium assets directly from node_modules ──────────
    // This avoids copying anything during `vite serve` — assets are resolved
    // on-demand from their source location in node_modules.
    configureServer(server) {
      // Map URL prefixes to their source directories. Order matters: more
      // specific prefixes must come before less specific ones.
      const mounts: Array<[string, string]> = [
        [`/${assetsPath}/ThirdParty`, join(engineRoot, "Source/ThirdParty")],
        [`/${assetsPath}/Assets`, join(engineRoot, "Source/Assets")],
        [`/${assetsPath}/Widget`, join(engineRoot, "Source/Widget")],
        [`/${assetsPath}`, join(engineRoot, "Build")],
      ];

      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split("?")[0] ?? "";

        for (const [prefix, fsDir] of mounts) {
          if (url.startsWith(prefix + "/") || url === prefix) {
            const relative = url.slice(prefix.length);
            const filePath = join(fsDir, relative);

            if (existsSync(filePath)) {
              // Rewrite the URL so Vite's built-in static middleware finds it
              // under the configured `fs.allow` directories.
              req.url = `/@fs/${filePath}`;
              return next();
            }
          }
        }

        next();
      });
    },

    // ── Build: copy assets after output is written ──────────────────────────
    // `closeBundle` runs after Rollup/Vite finishes writing all files,
    // in both one-shot build and --watch mode.
    closeBundle() {
      if (resolvedConfig.command !== "build") return;
      const outDir = resolve(process.cwd(), resolvedConfig.build.outDir);
      copyCesiumAssets(engineRoot, outDir, assetsPath, debug);
    },

    // ── virtual:cesium ────────────────────────────────────────────────────
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID;
      return undefined;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return undefined;

      // Expose typed constants so app code never reads window globals directly.
      return [
        `export const CESIUM_BASE_URL = ${JSON.stringify(cesiumBaseUrl + "/")};`,
        `export const ION_TOKEN = ${JSON.stringify(activeToken ?? null)};`,
      ].join("\n");
    },

    // ── Ion token injection ───────────────────────────────────────────────
    transform(code, id) {
      if (!isIonModule(id)) return undefined;
      if (activeToken === undefined) return undefined;

      const patched = code.replace(
        /Ion\.defaultAccessToken = defaultAccessToken(\$1)?/,
        `Ion.defaultAccessToken = "${activeToken}"`,
      );

      if (patched === code) {
        // The regex matched the module ID but the source replacement
        // didn't fire — Cesium may have changed the line in a newer version.
        const ctx = code.match(/.{0,60}defaultAccessToken.{0,60}/);
        warn(
          `Ion token: pattern not found in ${id}\n` +
            `  Expected: /Ion\.defaultAccessToken = defaultAccessToken(\$1)?/\n` +
            `  Found   : ${ctx?.[0] ?? "(defaultAccessToken not present)"}`,
        );
      } else if (debug) {
        log(`Ion token injected into: ${id}`);
      }

      return patched;
    },

    // ── HTML injection ────────────────────────────────────────────────────
    transformIndexHtml() {
      return [
        // CESIUM_BASE_URL must exist before any Cesium module initializes.
        {
          tag: "script",
          injectTo: "head-prepend" as const,
          children: `window.CESIUM_BASE_URL = ${JSON.stringify(cesiumBaseUrl + "/")};`,
        },
        {
          tag: "link",
          injectTo: "head" as const,
          attrs: {
            rel: "stylesheet",
            href: `${cesiumBaseUrl}/Widget/CesiumWidget.css`,
          },
        },
      ];
    },
  };
}
