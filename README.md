# vite-plugin-cesium-engine

Zero-config Vite plugin for [`@cesium/engine`](https://www.npmjs.com/package/@cesium/engine).  
Handles static assets, `CESIUM_BASE_URL`, widget CSS, and your Ion token — nothing to configure by hand.

[![npm](https://img.shields.io/npm/v/vite-plugin-cesium-engine.svg)](https://www.npmjs.com/package/vite-plugin-cesium-engine)
[![license](https://img.shields.io/npm/l/vite-plugin-cesium-engine.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/vite-plugin-cesium-engine.svg)](https://www.npmjs.com/package/vite-plugin-cesium-engine)

---

## Why this plugin?

Other Cesium Vite plugins target the full `cesium` / `@cesium/widgets` package.  
This one is purpose-built for **`@cesium/engine` only** — the lean, widget-free core — so your bundle stays small and you stay in control of the UI.

What it does for you automatically:

- ✅ Copies WASM workers, built files, assets, and `CesiumWidget.css` to your output
- ✅ Injects `window.CESIUM_BASE_URL` before any Cesium module loads
- ✅ Injects the `CesiumWidget.css` `<link>` tag
- ✅ Optionally bakes your Ion access token in at build time (per-environment support)
- ✅ Exposes a `virtual:cesium` module for typed access to runtime constants
- ✅ Validates your Ion token format and warns about misconfigurations at startup

---

## Install

```bash
# npm
npm i -D @cesium/engine vite-plugin-cesium-engine

# pnpm
pnpm add -D @cesium/engine vite-plugin-cesium-engine

# yarn
yarn add -D @cesium/engine vite-plugin-cesium-engine
```

---

## Usage

Add the plugin to your Vite config — that's it.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import cesiumEngine from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [cesiumEngine()],
});
```

Then use `@cesium/engine` directly — no boilerplate, no globals:

```ts
import { CesiumWidget } from "@cesium/engine";

const widget = new CesiumWidget(document.getElementById("cesium-container")!);
```

---

## Options

```ts
cesiumEngine({
  // Ion token — string or per-environment map (see below)
  ionToken: "eyJhbGci...",

  // Override where assets are served from (default: derived from Vite's base)
  cesiumBaseUrl: "/static/cesium",

  // Override where assets are copied to in the output dir (default: "cesium")
  assetsPath: "static/cesium",

  // Print what the plugin is doing at startup
  debug: true,
})
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ionToken` | `string \| Record<string, string>` | `undefined` | Ion access token. Use a plain string for all environments, or a `{ [mode]: token }` map for per-environment tokens. |
| `cesiumBaseUrl` | `string` | `"/${assetsPath}"` | URL path from which Cesium assets are served. Defaults to Vite's `base` + `assetsPath`. |
| `assetsPath` | `string` | `"cesium"` | Output subfolder (relative to `build.outDir`) where static assets are copied. |
| `debug` | `boolean` | `false` | Log asset copy targets, resolved token, and base URL at startup. |

---

## Per-environment Ion tokens

Pass an object keyed by Vite `mode` to use different tokens per environment.  
This is baked in at build time — no runtime env variables needed.

```ts
// vite.config.ts
cesiumEngine({
  ionToken: {
    development: process.env.CESIUM_ION_TOKEN_DEV,
    staging:     process.env.CESIUM_ION_TOKEN_STAGING,
    production:  process.env.CESIUM_ION_TOKEN_PROD,
    // Optional fallback for any unrecognized mode:
    default:     process.env.CESIUM_ION_TOKEN_DEV,
  },
})
```

```bash
vite build --mode staging   # uses CESIUM_ION_TOKEN_STAGING
vite build                  # uses CESIUM_ION_TOKEN_PROD  (mode defaults to "production")
vite dev                    # uses CESIUM_ION_TOKEN_DEV   (mode defaults to "development")
```

---

## Virtual module — `virtual:cesium`

The plugin exposes a typed virtual module so your app code can read
`CESIUM_BASE_URL` and `ION_TOKEN` without reaching for `window` globals.

Add the types to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite-plugin-cesium-engine/virtual"]
  }
}
```

Then import anywhere in your app:

```ts
import { CESIUM_BASE_URL, ION_TOKEN } from "virtual:cesium";

console.log(CESIUM_BASE_URL); // e.g. "/cesium/"
console.log(ION_TOKEN);       // your token, or null
```

---

## Custom asset path

Use `assetsPath` + `cesiumBaseUrl` together when deploying to a CDN or a
framework with an opinionated public directory (Laravel, Rails, etc.).

```ts
// vite.config.ts
export default defineConfig({
  base: "/app/",
  plugins: [
    cesiumEngine({
      assetsPath: "vendor/cesium",     // copied to dist/vendor/cesium/
      cesiumBaseUrl: "/app/vendor/cesium", // served from this URL
    }),
  ],
});
```

The plugin will warn you at startup if `cesiumBaseUrl` doesn't start with
Vite's `base`, which would cause assets to resolve incorrectly.

---

## Debug mode

```ts
cesiumEngine({ debug: true })
```

Output at dev-server startup:

```console
[cesium-engine] mode         : development
[cesium-engine] vite base    : ""
[cesium-engine] cesiumBaseUrl: "/cesium"
[cesium-engine] assetsPath   : "cesium"
[cesium-engine] ionToken     : eyJhbGciOiJ… (mode: development)
[cesium-engine] copying assets:
  ThirdParty/*.wasm → cesium/ThirdParty
  Build/*           → cesium
  Source/Assets/    → cesium
  Widget/*.css      → cesium/Widget
```

---

## Examples

Complete, ready-to-run starter projects are available in the [`examples/`](./examples) directory:

| Example | Stack | Description |
| --- | --- | --- |
| [`examples/react`](./examples/react) | React 19 + TypeScript | `useEffect` lifecycle, HMR-safe widget init |
| [`examples/vue`](./examples/vue) | Vue 3 + TypeScript | Composition API, `onMounted` / `onBeforeUnmount` |
| [`examples/svelte`](./examples/svelte) | Svelte 5 + TypeScript | `onMount` with return-value cleanup |
| [`examples/vanilla`](./examples/vanilla) | Vanilla TypeScript | Zero framework, `import.meta.hot` HMR cleanup |

Each example includes all project files and can be run with:

```bash
cd examples/react   # or vue / svelte / vanilla
pnpm install
pnpm dev
```

---

## Known warnings

### `[EVAL] Use of direct eval function is strongly discouraged`

This comes from `protobufjs`, a transitive dependency of `@cesium/engine`. The eval is intentional in that library (used for optional `require()` resolution) and is not a security risk in practice. Suppress it in your app's `vite.config.ts`:

```ts
build: {
  rollupOptions: {
    onwarn(warning, defaultHandler) {
      if (warning.code === "EVAL" && warning.id?.includes("protobufjs")) return;
      defaultHandler(warning);
    },
  },
},
```

---

## License

[MIT](LICENSE)
