// ─── Virtual module identifiers ───────────────────────────────────────────────

export const VIRTUAL_CESIUM_ID = "virtual:cesium";
export const RESOLVED_VIRTUAL_CESIUM_ID = "\0virtual:cesium";

export const VIRTUAL_VERSION_ID = "virtual:cesium/version";
export const RESOLVED_VIRTUAL_VERSION_ID = "\0virtual:cesium/version";

// ─── Module source generators ─────────────────────────────────────────────────

export function virtualCesiumSource(
  cesiumBaseUrl: string,
  activeToken: string | undefined,
): string {
  return [
    `export const CESIUM_BASE_URL = ${JSON.stringify(cesiumBaseUrl + "/")};`,
    `export const ION_TOKEN = ${JSON.stringify(activeToken ?? null)};`,
  ].join("\n");
}

export function virtualVersionSource(version: string): string {
  return `export const CESIUM_VERSION = ${JSON.stringify(version)};`;
}
