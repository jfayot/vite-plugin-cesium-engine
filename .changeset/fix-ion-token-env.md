---
"vite-plugin-cesium-engine": patch
---

Load unprefixed Cesium Ion token variables from Vite's environment directory
and the shell. Respect mode-specific files, custom `envDir`, and explicit
token options without changing Vite's client environment prefix.
