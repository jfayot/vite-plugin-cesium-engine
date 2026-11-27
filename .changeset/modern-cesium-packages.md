---
"vite-plugin-cesium-engine": minor
---

Include `@cesium/core` and `@cesium/gltf` alongside `@cesium/engine` in the
Cesium output chunk. Update examples to import core types directly, align
external assets with CesiumJS 1.147 / engine 26.5, and refresh workspace
dependencies. Verify builds and development asset serving with engine 26.2
(before the package split) and the current engine release.

Fix development asset routing when Vite uses a non-root base such as `/app/`.
