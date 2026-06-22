import { type IonTokenConfig } from "./token.js";

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
   * Split `@cesium/engine` into a dedicated output chunk with this name,
   * keeping it independently cacheable from your app code.
   *
   * Equivalent to manually adding `manualChunks: cesiumChunks(chunkName)`
   * to your Rollup output options, but configured in one place.
   *
   * @example
   * ```ts
   * cesiumEngine({ chunkName: "vendor-cesium" })
   * ```
   *
   * @default undefined (no manual chunking — Cesium is bundled with your app)
   */
  chunkName?: string;

  /**
   * Emit debug logs showing which files are copied and which Ion token
   * (if any) is injected. Logs are prefixed with `[cesium-engine]`.
   *
   * @default false
   */
  debug?: boolean;
};
