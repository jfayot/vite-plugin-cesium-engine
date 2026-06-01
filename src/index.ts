import {
  existsSync,
  cpSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  readFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { type Plugin, type ResolvedConfig } from "vite";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Ion access token configuration.
 *
 * Accepts:
 * - A plain `string` — same token in every environment
 * - A `Record<string, string>` — keyed by Vite `mode`
 * - A callback `(mode: string) => string | Promise<string>` — resolved at
 *   build start, useful for secrets managers or async vault lookups
 *
 * When omitted, the plugin looks for `CESIUM_ION_TOKEN` (or
 * `CESIUM_ION_TOKEN_<MODE>`) in the Vite env automatically.
 *
 * @example plain string
 * ```ts
 * ionToken: "eyJhbGci..."
 * ```
 *
 * @example per-environment map
 * ```ts
 * ionToken: {
 *   development: "eyJhbGci...",
 *   production:  "eyJhbGci...",
 * }
 * ```
 *
 * @example async callback (e.g. AWS Secrets Manager)
 * ```ts
 * ionToken: async (mode) => {
 *   const secret = await getSecret(`cesium-ion-token-${mode}`);
 *   return secret.value;
 * }
 * ```
 */
export type IonTokenCallback = (mode: string) => string | Promise<string>;
export type IonTokenConfig = string | Record<string, string> | IonTokenCallback;

export type CesiumEngineOptions = {
  /**
   * Cesium Ion default access token, baked in at build time.
   *
   * Accepts a plain string, a `{ [mode]: token }` map, or an async callback
   * `(mode) => Promise<string>` for secrets manager / vault integrations.
   *
   * When omitted, the plugin automatically checks the following environment
   * variables (loaded by Vite from your `.env` files):
   *   - `CESIUM_ION_TOKEN_<MODE>` — e.g. `CESIUM_ION_TOKEN_PRODUCTION`
   *   - `CESIUM_ION_TOKEN`        — generic fallback for any mode
   *
   * Explicit `ionToken` always takes priority over env vars.
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

async function resolveToken(
  tokenConfig: IonTokenConfig | undefined,
  mode: string,
  env: Record<string, string>,
): Promise<string | undefined> {
  // 1. Explicit option takes priority
  if (tokenConfig !== undefined) {
    if (typeof tokenConfig === "function") {
      const result = await tokenConfig(mode);
      return result || undefined;
    }
    if (typeof tokenConfig === "string") return tokenConfig || undefined;
    return tokenConfig[mode] ?? tokenConfig["default"] ?? undefined;
  }

  // 2. Auto env detection: mode-specific key first, then generic key
  const modeKey = `CESIUM_ION_TOKEN_${mode.toUpperCase()}`;
  return env[modeKey] || env["CESIUM_ION_TOKEN"] || undefined;
}

function validateToken(token: string, mode: string): void {
  if (!ION_TOKEN_RE.test(token)) {
    warn(
      `ionToken for mode "${mode}" does not look like a valid Cesium Ion JWT. ` +
        `Double-check the value at https://ion.cesium.com/tokens`,
    );
  }
}

function logResolvedToken(
  token: string | undefined,
  config: IonTokenConfig | undefined,
  mode: string,
  env: Record<string, string>,
): void {
  if (token === undefined) {
    log(`ionToken     : none (using Cesium default)`);
    return;
  }
  const preview = `${token.slice(0, 12)}...`;
  if (typeof config === "function") {
    log(`ionToken     : ${preview} (mode: ${mode}, via callback)`);
  } else if (config === undefined) {
    const envKey = env[`CESIUM_ION_TOKEN_${mode.toUpperCase()}`]
      ? `CESIUM_ION_TOKEN_${mode.toUpperCase()}`
      : "CESIUM_ION_TOKEN";
    log(`ionToken     : ${preview} (from env ${envKey})`);
  } else {
    log(`ionToken     : ${preview} (mode: ${mode})`);
  }
}

function normalizePath(raw: string): string {
  let start = 0;
  let end = raw.length;

  while (start < end && raw.charCodeAt(start) === 47) start++;

  while (end > start && raw.charCodeAt(end - 1) === 47) end--;

  return "/" + raw.slice(start, end);
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
      label: `ThirdParty/*.wasm -> ${assetsPath}/ThirdParty`,
      fn: () =>
        copyByExtension(
          join(engineRoot, "Source/ThirdParty"),
          join(dest, "ThirdParty"),
          ".wasm",
        ),
    },
    {
      label: `Build/* -> ${assetsPath}`,
      fn: () => copyDir(join(engineRoot, "Build"), dest),
    },
    {
      label: `Source/Assets/ -> ${assetsPath}/Assets`,
      fn: () =>
        copyDir(join(engineRoot, "Source/Assets"), join(dest, "Assets")),
    },
    {
      label: `Widget/*.css -> ${assetsPath}/Widget`,
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

// ─── Virtual modules ──────────────────────────────────────────────────────────

const VIRTUAL_CESIUM_ID = "virtual:cesium";
const RESOLVED_VIRTUAL_CESIUM_ID = "\0virtual:cesium";

const VIRTUAL_VERSION_ID = "virtual:cesium/version";
const RESOLVED_VIRTUAL_VERSION_ID = "\0virtual:cesium/version";

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
  let installedCesiumVersion: string;

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

  // Read installed version from @cesium/engine's own package.json
  try {
    const pkgJson = JSON.parse(
      readFileSync(join(engineRoot, "package.json"), "utf-8"),
    ) as { version: string };
    installedCesiumVersion = pkgJson.version;
  } catch {
    installedCesiumVersion = "unknown";
  }

  return {
    name: "vite-plugin-cesium-engine",
    enforce: "pre",

    // ── config: set CESIUM_BASE_URL define ────────────────────────────────
    config(userConfig) {
      const viteBase = (userConfig.base ?? "").replace(/\/$/, "");
      const resolvedCesiumBaseUrl = cesiumBaseUrlOption
        ? normalizePath(cesiumBaseUrlOption)
        : `${viteBase}/${assetsPath}`;

      return {
        define: {
          CESIUM_BASE_URL: JSON.stringify(resolvedCesiumBaseUrl + "/"),
        },
      };
    },

    // ── configResolved: derive all runtime values once ────────────────────
    configResolved(cfg) {
      resolvedConfig = cfg;
      const { mode } = cfg;

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
      }
    },

    // ── Dev server: serve Cesium assets directly from node_modules ────────
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

    // ── buildStart: resolve async token ───────────────────────────────────
    async buildStart() {
      const { mode, env } = resolvedConfig;

      activeToken = await resolveToken(ionTokenConfig, mode, env);

      if (activeToken !== undefined) {
        validateToken(activeToken, mode);
      }

      if (debug) {
        logResolvedToken(activeToken, ionTokenConfig, mode, env);
      }
    },

    // ── Build: copy assets after output is written ────────────────────────
    // `closeBundle` runs after Rollup/Vite finishes writing all files,
    // in both one-shot build and --watch mode.
    closeBundle() {
      if (resolvedConfig.command !== "build") return;
      const outDir = resolve(process.cwd(), resolvedConfig.build.outDir);
      copyCesiumAssets(engineRoot, outDir, assetsPath, debug);
    },

    // ── Virtual modules ───────────────────────────────────────────────────
    resolveId(id) {
      if (id === VIRTUAL_CESIUM_ID) return RESOLVED_VIRTUAL_CESIUM_ID;
      if (id === VIRTUAL_VERSION_ID) return RESOLVED_VIRTUAL_VERSION_ID;
      return undefined;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_CESIUM_ID) {
        return [
          `export const CESIUM_BASE_URL = ${JSON.stringify(cesiumBaseUrl + "/")};`,
          `export const ION_TOKEN = ${JSON.stringify(activeToken ?? null)};`,
        ].join("\n");
      }

      if (id === RESOLVED_VIRTUAL_VERSION_ID) {
        return `export const CESIUM_VERSION = ${JSON.stringify(installedCesiumVersion)};`;
      }

      return undefined;
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
