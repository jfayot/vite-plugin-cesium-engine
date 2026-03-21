import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

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

// Matches both the ESM bundle used during `vite serve` and the individual
// source file used during `vite build`.
const ION_MODULE_RE =
  /@cesium\/engine(\/Source\/Core\/Ion\.js|[^/]*cesium_engine[^/]*\.js)/;

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
  mode: string
): string | undefined {
  if (tokenConfig === undefined) return undefined;
  if (typeof tokenConfig === "string") return tokenConfig;
  return tokenConfig[mode] ?? tokenConfig["default"];
}

function validateToken(token: string, mode: string): void {
  if (!ION_TOKEN_RE.test(token)) {
    warn(
      `ionToken for mode "${mode}" does not look like a valid Cesium Ion JWT. ` +
        `Double-check the value at https://ion.cesium.com/tokens`
    );
  }
}

function normalisePath(raw: string): string {
  // Strip trailing slash, ensure leading slash.
  return "/" + raw.replace(/^\/|\/$/g, "");
}

// ─── Virtual module: `virtual:cesium` ────────────────────────────────────────

const VIRTUAL_MODULE_ID = "virtual:cesium";
const RESOLVED_VIRTUAL_ID = "\0virtual:cesium";

// ─── Plugin factory ───────────────────────────────────────────────────────────

export function cesiumEngine(options: CesiumEngineOptions = {}): Plugin[] {
  const {
    ionToken: ionTokenConfig,
    cesiumBaseUrl: cesiumBaseUrlOption,
    assetsPath = "cesium",
    debug = false,
  } = options;

  let activeToken: string | undefined;
  // Final URL exposed to the browser (and to `virtual:cesium`).
  let cesiumBaseUrl: string;

  // ── Peer dependency check ───────────────────────────────────────────────────
  const enginePath = resolve(process.cwd(), "node_modules/@cesium/engine");
  if (!existsSync(enginePath)) {
    throw new Error(
      "[cesium-engine] Could not find @cesium/engine in node_modules.\n" +
        "Install it as a dependency:\n\n" +
        "  npm i @cesium/engine\n" +
        "  # or: pnpm add @cesium/engine\n"
    );
  }

  return [
    // ── 1. Static asset copy (wasm, workers, assets, widget css) ─────────────
    ...viteStaticCopy({
      targets: [
        {
          src: `node_modules/@cesium/engine/Source/ThirdParty/*.wasm`,
          dest: `${assetsPath}/ThirdParty`,
        },
        {
          src: `node_modules/@cesium/engine/Build/*`,
          dest: assetsPath,
        },
        {
          src: `node_modules/@cesium/engine/Source/Assets/`,
          dest: assetsPath,
        },
        {
          src: `node_modules/@cesium/engine/Source/Widget/*.css`,
          dest: `${assetsPath}/Widget`,
        },
      ],
    }),

    // ── 2. Core plugin ────────────────────────────────────────────────────────
    {
      name: "vite-plugin-cesium-engine",
      enforce: "pre",

      // ── configResolved: derive all runtime values once ────────────────────
      configResolved(cfg) {
        const { mode } = cfg;

        // Resolve Ion token for this mode.
        activeToken = resolveToken(ionTokenConfig, mode);
        if (activeToken !== undefined) {
          validateToken(activeToken, mode);
        }

        // Build CESIUM_BASE_URL: explicit option wins, then derive from Vite base.
        const viteBase = (cfg.base ?? "").replace(/\/$/, "");
        cesiumBaseUrl = cesiumBaseUrlOption
          ? normalisePath(cesiumBaseUrlOption)
          : `${viteBase}/${assetsPath}`;

        // Warn when Vite's base and an explicit cesiumBaseUrl look inconsistent.
        if (
          cesiumBaseUrlOption &&
          viteBase &&
          !cesiumBaseUrl.startsWith(viteBase)
        ) {
          warn(
            `cesiumBaseUrl ("${cesiumBaseUrl}") does not start with Vite's ` +
              `base ("${viteBase}"). Assets may not resolve correctly.`
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
            }`
          );
          log(
            `copying assets:\n` +
              [
                `  ThirdParty/*.wasm → ${assetsPath}/ThirdParty`,
                `  Build/*           → ${assetsPath}`,
                `  Source/Assets/    → ${assetsPath}`,
                `  Widget/*.css      → ${assetsPath}/Widget`,
              ].join("\n")
          );
        }
      },

      // ── virtual:cesium ────────────────────────────────────────────────────
      resolveId(id) {
        if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID;
      },

      load(id) {
        if (id !== RESOLVED_VIRTUAL_ID) return;

        // Expose typed constants so app code never reads window globals directly.
        return [
          `export const CESIUM_BASE_URL = ${JSON.stringify(cesiumBaseUrl + "/")};`,
          `export const ION_TOKEN = ${JSON.stringify(activeToken ?? null)};`,
        ].join("\n");
      },

      // ── Ion token injection ───────────────────────────────────────────────
      transform(code, id) {
        if (activeToken === undefined) return;
        if (!ION_MODULE_RE.test(id)) return;

        const patched = code.replace(
          /Ion\.defaultAccessToken\s*=\s*defaultAccessToken/,
          `Ion.defaultAccessToken = "${activeToken}"`
        );

        if (debug && patched !== code) {
          log(`Ion token injected into: ${id}`);
        }

        return patched;
      },

      // ── HTML injection ────────────────────────────────────────────────────
      transformIndexHtml() {
        return [
          // CESIUM_BASE_URL must exist before any Cesium module initialises.
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
    },
  ];
}
