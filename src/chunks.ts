/**
 * Rollup `manualChunks` helper that isolates `@cesium/engine`, `@cesium/core`,
 * and `@cesium/gltf` modules in a dedicated, independently cacheable chunk.
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
    if (/(?:^|[/\\])@cesium[/\\](?:engine|core|gltf)(?:[/\\]|$)/.test(id)) {
      return chunkName;
    }
    return undefined;
  };
}
