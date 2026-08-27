---
"vite-plugin-cesium-engine": minor
---

Add an external asset mode for CDN-hosted Cesium assets. Setting `assets` to
`"external"` now skips build-time asset copying and local development
middleware while preserving absolute HTTP(S) `cesiumBaseUrl` values.
Add `widgetCssUrl` so the injected stylesheet can use a different CDN path,
including the native npm package layout.
