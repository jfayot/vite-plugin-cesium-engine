import { CesiumWidget, Terrain } from "@cesium/engine";

const widget = new CesiumWidget(document.getElementById("app")!, {
  terrain: Terrain.fromWorldTerrain(),
});

// Cleanup on HMR dispose (dev only)
if (import.meta.hot) {
  import.meta.hot.dispose(() => widget.destroy());
}
