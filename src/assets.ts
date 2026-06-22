import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { log } from "./utils.js";
import { type ViteDevServer } from "vite";

// ─── File copy helpers ────────────────────────────────────────────────────────

/**
 * Copy all files with a given extension from `srcDir` into `destDir`.
 * Non-recursive — only top-level files are matched.
 */
export function copyByExtension(srcDir: string, destDir: string, ext: string): void {
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
export function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true, force: true });
}

// ─── Build-time asset copy ────────────────────────────────────────────────────

/**
 * Copy all Cesium static assets from `engineRoot` into `outDir/assetsPath`.
 * Called once after `vite build` finishes writing output.
 */
export function copyCesiumAssets(
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
        copyByExtension(join(engineRoot, "Source/ThirdParty"), join(dest, "ThirdParty"), ".wasm"),
    },
    {
      label: `Build/* -> ${assetsPath}`,
      fn: () => copyDir(join(engineRoot, "Build"), dest),
    },
    {
      label: `Source/Assets/ -> ${assetsPath}/Assets`,
      fn: () => copyDir(join(engineRoot, "Source/Assets"), join(dest, "Assets")),
    },
    {
      label: `Widget/*.css -> ${assetsPath}/Widget`,
      fn: () => copyByExtension(join(engineRoot, "Source/Widget"), join(dest, "Widget"), ".css"),
    },
  ];

  for (const { label, fn } of copies) {
    if (debug) log(`copying: ${label}`);
    fn();
  }
}

// ─── Dev-server middleware ────────────────────────────────────────────────────

// This avoids copying anything during `vite serve` — assets are resolved
// on-demand from their source location in node_modules.
export function registerDevServerMiddleware(
  server: ViteDevServer,
  engineRoot: string,
  assetsPath: string,
) {
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
}
