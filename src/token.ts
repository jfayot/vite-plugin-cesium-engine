// ─── Types ────────────────────────────────────────────────────────────────────

import { log, warn } from "./utils.js";

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

// ─── Validation ───────────────────────────────────────────────────────────────

// Cesium Ion tokens are JWTs — a rough but useful sanity check.
const ION_TOKEN_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function validateToken(token: string, mode: string): void {
  if (!ION_TOKEN_RE.test(token)) {
    warn(
      `ionToken for mode "${mode}" does not look like a valid Cesium Ion JWT. ` +
        `Double-check the value at https://ion.cesium.com/tokens`,
    );
  }
}

// ─── Resolution ───────────────────────────────────────────────────────────────

export async function resolveToken(
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

// ─── Debug logging ────────────────────────────────────────────────────────────

export function logResolvedToken(
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
