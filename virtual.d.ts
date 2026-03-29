/**
 * Virtual module injected by `vite-plugin-cesium-engine`.
 *
 * Provides typed access to runtime constants without touching `window` directly.
 *
 * @example
 * ```ts
 * import { CESIUM_BASE_URL, ION_TOKEN } from "virtual:cesium";
 *
 * console.log(CESIUM_BASE_URL); // e.g. "/cesium/"
 * console.log(ION_TOKEN);       // your Ion token, or null
 * ```
 */
declare module "virtual:cesium" {
  /** The base URL where Cesium's static assets are served, always ending with `/`. */
  export const CESIUM_BASE_URL: string;

  /** The active Cesium Ion access token for this build, or `null` if not set. */
  export const ION_TOKEN: string | null;
}

/**
 * Virtual module injected by `vite-plugin-cesium-engine`.
 *
 * Exposes the installed `@cesium/engine` version string, resolved at build time.
 *
 * @example
 * ```ts
 * import { CESIUM_VERSION } from "virtual:cesium/version";
 *
 * console.log(CESIUM_VERSION); // e.g. "23.0.1"
 * ```
 */
declare module "virtual:cesium/version" {
  /** The installed `@cesium/engine` version string (e.g. `"23.0.1"`). */
  export const CESIUM_VERSION: string;
}
