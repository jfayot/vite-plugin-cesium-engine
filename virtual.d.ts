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
