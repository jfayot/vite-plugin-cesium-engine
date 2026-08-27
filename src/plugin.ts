import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import {
  RESOLVED_VIRTUAL_CESIUM_ID,
  RESOLVED_VIRTUAL_VERSION_ID,
  VIRTUAL_CESIUM_ID,
  VIRTUAL_VERSION_ID,
  virtualCesiumSource,
  virtualVersionSource,
} from "./virtual.js";
import { isIonModule, log, normalizeBaseUrl, warn } from "./utils.js";
import { copyCesiumAssets, registerDevServerMiddleware } from "./assets.js";
import { logResolvedToken, resolveToken, validateToken } from "./token.js";
import { type CesiumEngineOptions } from "./types.js";
import { cesiumChunks } from "./chunks.js";

// ─── Plugin factory ───────────────────────────────────────────────────────────

export function cesiumEngine(options: CesiumEngineOptions = {}): Plugin {
  const {
    ionToken: ionTokenConfig,
    assets = "copy",
    cesiumBaseUrl: cesiumBaseUrlOption,
    widgetCssUrl: widgetCssUrlOption,
    assetsPath = "cesium",
    enginePath,
    chunkName,
    debug = false,
  } = options;

  if (assets === "external" && !cesiumBaseUrlOption) {
    throw new Error(
      '[cesium-engine] `cesiumBaseUrl` is required when `assets` is set to "external".',
    );
  }

  let activeToken: string | undefined;
  // Final URL exposed to the browser (and to `virtual:cesium`).
  let cesiumBaseUrl: string;
  let resolvedConfig: ResolvedConfig;
  let installedCesiumVersion: string;
  let engineRoot: string;

  return {
    name: "vite-plugin-cesium-engine",
    enforce: "pre",

    // ── config: set CESIUM_BASE_URL define ────────────────────────────────
    config(userConfig) {
      const viteBase = (userConfig.base ?? "").replace(/\/$/, "");
      const resolvedCesiumBaseUrl = cesiumBaseUrlOption
        ? normalizeBaseUrl(cesiumBaseUrlOption)
        : `${viteBase}/${assetsPath}`;

      return {
        define: {
          CESIUM_BASE_URL: JSON.stringify(resolvedCesiumBaseUrl + "/"),
        },
        ...(chunkName !== undefined && {
          build: {
            rollupOptions: {
              output: {
                manualChunks: cesiumChunks(chunkName),
              },
            },
          },
        }),
      };
    },

    // ── configResolved: derive all runtime values once ────────────────────
    configResolved(cfg) {
      resolvedConfig = cfg;
      const { mode } = cfg;

      // Project-relative paths follow Vite's root, which can differ from the
      // process working directory in monorepos and programmatic builds.
      engineRoot = enginePath
        ? resolve(cfg.root, enginePath)
        : resolve(cfg.root, "node_modules/@cesium/engine");

      if (!existsSync(engineRoot)) {
        throw new Error(
          `[cesium-engine] Could not find @cesium/engine at ${engineRoot}.\n` +
            "Install it as a dependency or set the enginePath option:\n\n" +
            "  npm i @cesium/engine\n" +
            "  # or: pnpm add @cesium/engine\n",
        );
      }

      try {
        const pkgJson = JSON.parse(readFileSync(join(engineRoot, "package.json"), "utf-8")) as {
          version: string;
        };
        installedCesiumVersion = pkgJson.version;
      } catch {
        installedCesiumVersion = "unknown";
      }

      // Build CESIUM_BASE_URL: explicit option wins, then derive from Vite base.
      const viteBase = (cfg.base ?? "").replace(/\/$/, "");
      cesiumBaseUrl = cesiumBaseUrlOption
        ? normalizeBaseUrl(cesiumBaseUrlOption)
        : `${viteBase}/${assetsPath}`;

      // Warn when Vite's base and an explicit cesiumBaseUrl look inconsistent.
      if (
        assets === "copy" &&
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
        log(`assets       : "${assets}"`);
        log(`enginePath   : "${engineRoot}"`);
      }
    },

    // ── Dev server: serve Cesium assets directly from node_modules ────────
    configureServer(server) {
      if (assets === "external") return;
      registerDevServerMiddleware(server, engineRoot, assetsPath);
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
      if (assets === "external") return;
      const outDir = resolve(resolvedConfig.root, resolvedConfig.build.outDir);
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
        return virtualCesiumSource(cesiumBaseUrl, activeToken);
      }

      if (id === RESOLVED_VIRTUAL_VERSION_ID) {
        return virtualVersionSource(installedCesiumVersion);
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
            `  Expected: /Ion.defaultAccessToken = defaultAccessToken($1)?/\n` +
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
            href: widgetCssUrlOption
              ? normalizeBaseUrl(widgetCssUrlOption)
              : `${cesiumBaseUrl}/Widget/CesiumWidget.css`,
          },
        },
      ];
    },
  };
}
