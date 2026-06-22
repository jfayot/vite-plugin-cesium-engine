// ─── Logging ──────────────────────────────────────────────────────────────────

export function log(message: string): void {
  console.log(`\x1b[36m[cesium-engine]\x1b[0m ${message}`);
}

export function warn(message: string): void {
  console.warn(`\x1b[33m[cesium-engine]\x1b[0m ${message}`);
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** Strip leading/trailing slashes then re-add a single leading slash. */
export function normalizePath(raw: string): string {
  let start = 0;
  let end = raw.length;

  while (start < end && raw.charCodeAt(start) === 47) start++;

  while (end > start && raw.charCodeAt(end - 1) === 47) end--;

  return "/" + raw.slice(start, end);
}

// ─── Module detection ─────────────────────────────────────────────────────────

// Detect the Ion module by plain substring checks. The ID can take three forms:
//
//   dev   (absolute path) : /.../node_modules/@cesium/engine/Source/Core/Ion.js
//   build (bare source)   : @cesium/engine/Source/Core/Ion.js
//   build (bundled)       : ...@cesium_engine.js...
export function isIonModule(id: string): boolean {
  return (
    id.includes("@cesium/engine/Source/Core/Ion.js") ||
    id.includes("@cesium\\engine\\Source\\Core\\Ion.js") ||
    id.includes("@cesium_engine.js")
  );
}
