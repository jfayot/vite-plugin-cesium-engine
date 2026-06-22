/**
 * Rollup `manualChunks` helper that isolates all `@cesium/engine` modules into
 * a dedicated chunk, keeping it independently cacheable from your app.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { cesiumEngine, cesiumChunks } from "vite-plugin-cesium-engine";
 *
 * export default defineConfig({
 *   plugins: [cesiumEngine()],
 *   build: {
 *     rollupOptions: {
 *       output: { manualChunks: cesiumChunks() },
 *     },
 *   },
 * });
 * ```
 *
 * @param chunkName - Output chunk filename without extension. Defaults to `"cesium"`.
 */
export function cesiumChunks(chunkName = "cesium"): (id: string) => string | undefined {
  return (id: string) => {
    if (id.includes("@cesium/engine") || id.includes("@cesium\\engine")) {
      return chunkName;
    }
    return undefined;
  };
}
