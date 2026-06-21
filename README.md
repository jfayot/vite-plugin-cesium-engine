# vite-plugin-cesium-engine

Zero-config Vite plugin for [`@cesium/engine`](https://www.npmjs.com/package/@cesium/engine).  
Handles static assets, `CESIUM_BASE_URL`, widget CSS, and your Ion token — nothing to configure by hand.

[![npm](https://img.shields.io/npm/v/vite-plugin-cesium-engine.svg)](https://www.npmjs.com/package/vite-plugin-cesium-engine)
[![license](https://img.shields.io/npm/l/vite-plugin-cesium-engine.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/vite-plugin-cesium-engine.svg)](https://www.npmjs.com/package/vite-plugin-cesium-engine)
![build](https://github.com/jfayot/vite-plugin-cesium-engine/actions/workflows/main.yml/badge.svg)
![release](https://github.com/jfayot/vite-plugin-cesium-engine/actions/workflows/release.yml/badge.svg)
[![All Contributors](https://img.shields.io/github/all-contributors/jfayot/vite-plugin-cesium-engine?color=ee8449&style=flat-square)](#contributors)
---

## Why this plugin?

Other Cesium Vite plugins target the full `cesium` package.  
This one is purpose-built for **`@cesium/engine` only** — the lean, widget-free core — so you stay in control of the UI.

What it does for you automatically:

- ✅ Copies WASM workers, built files, assets, and `CesiumWidget.css` to your output
- ✅ Sets `CESIUM_BASE_URL` as a compile-time `define` constant (no runtime script needed)
- ✅ Injects the `CesiumWidget.css` `<link>` tag
- ✅ Optionally bakes your Ion access token in at build time (per-environment support)
- ✅ Auto-detects `CESIUM_ION_TOKEN` / `CESIUM_ION_TOKEN_<MODE>` from `.env` files
- ✅ Exposes `virtual:cesium` and `virtual:cesium/version` modules for typed access to build-time constants
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
import { cesiumEngine } from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [cesiumEngine()],
});
```

Then use `@cesium/engine` directly — no boilerplate, no globals:

```ts
import { CesiumWidget } from "@cesium/engine";

const widget = new CesiumWidget(document.getElementById("cesium-container")!);
```

`CESIUM_BASE_URL` is set via Vite's `define` mechanism — it's replaced as a compile-time constant inside Cesium's source during bundling, which is how Cesium intends it to be consumed. No `window.CESIUM_BASE_URL` script tag is injected at runtime.

---

## Options

```ts
cesiumEngine({
  // Ion token — string, per-environment map, sync/async callback, or omit to auto-read from .env
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
| `ionToken` | `string \| Record<string, string> \| (mode) => string \| Promise<string>` | `undefined` | Ion access token. String, per-mode map, or sync/async callback. Omit to auto-read from `.env`. |
| `cesiumBaseUrl` | `string` | `"/${assetsPath}"` | URL path from which Cesium assets are served. Defaults to Vite's `base` + `assetsPath`. |
| `assetsPath` | `string` | `"cesium"` | Output subfolder (relative to `build.outDir`) where static assets are copied. |
| `debug` | `boolean` | `false` | Log asset copy targets, resolved token, and base URL at startup. |

---

## Ion token

### Callback (async)

Pass an async function to fetch the token from a secrets manager, vault, or any
async source. The callback receives the current Vite `mode` and must return a
`string` or `Promise<string>`. It is called once at build start, after
`configResolved` — which means sync token sources (string, map, env vars) are
available immediately, while the callback result is ready before any module
transforms run.

```ts
cesiumEngine({
  ionToken: async (mode) => {
    // AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, etc.
    const secret = await getSecret(`cesium-ion-token-${mode}`);
    return secret.value;
  },
})
```

The callback takes priority over `.env` variables. Returning an empty string is
treated as no token (Cesium's built-in default is used).

### Auto `.env` detection

When `ionToken` is not set in the plugin options, the plugin automatically reads
your Ion token from Vite's loaded environment variables — no boilerplate needed.

Place your token in a `.env` file at the project root:

```bash
# .env
CESIUM_ION_TOKEN=eyJhbGci...
```

Or use a mode-specific file to keep tokens per environment:

```bash
# .env.production
CESIUM_ION_TOKEN_PRODUCTION=eyJhbGci...

# .env.development
CESIUM_ION_TOKEN_DEVELOPMENT=eyJhbGci...
```

The lookup order is:

1. `CESIUM_ION_TOKEN_<MODE>` (uppercased, e.g. `CESIUM_ION_TOKEN_PRODUCTION`)
2. `CESIUM_ION_TOKEN` — generic fallback for any mode
3. Nothing — Cesium's own built-in default token is used

Explicit `ionToken` in the plugin options always takes priority over env vars.

> **Note:** these variables do **not** need the `VITE_` prefix. The plugin reads
> them server-side during the build and bakes the value in as a string literal.

When `debug: true` is set, the plugin logs which variable it picked up:

```console
[cesium-engine] ionToken     : read from env var CESIUM_ION_TOKEN_PRODUCTION
```

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

## Virtual modules

The plugin exposes typed virtual modules so app code never needs to touch
`window` globals or hardcode paths.

Add the types to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite-plugin-cesium-engine/virtual"]
  }
}
```

### `virtual:cesium`

```ts
import { CESIUM_BASE_URL, ION_TOKEN } from "virtual:cesium";

console.log(CESIUM_BASE_URL); // e.g. "/cesium/"
console.log(ION_TOKEN);       // your token, or null
```

### `virtual:cesium/version`

```ts
import { CESIUM_VERSION } from "virtual:cesium/version";

console.log(CESIUM_VERSION); // e.g. "25.0.0"
```

Useful for logging, bug reports, or conditional behavior when supporting
multiple Cesium versions in the same codebase.

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
[cesium-engine] vite base    : "(empty)"
[cesium-engine] cesiumBaseUrl: "/cesium"
[cesium-engine] assetsPath   : "cesium"
[cesium-engine] ionToken     : eyJhbGciOiJ... (mode: development)
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
pnpm install
pnpm dev:react
pnpm dev:svelte
pnpm dev:vanilla-ts
pnpm dev:vue
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

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/jamil-ur-rehman-ahmadzai-8424081b1/"><img src="https://avatars.githubusercontent.com/u/12057312?v=4?s=100" width="100px;" alt="Jamil Ur Rehman Ahmadzai"/><br /><sub><b>Jamil Ur Rehman Ahmadzai</b></sub></a><br /><a href="#code-jamilahmadzai" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://etuardu.github.io/"><img src="https://avatars.githubusercontent.com/u/6411154?v=4?s=100" width="100px;" alt="etuardu"/><br /><sub><b>etuardu</b></sub></a><br /><a href="#code-etuardu" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

---

## License

[MIT](LICENSE)
