import { CesiumWidget, Terrain } from "@cesium/engine";
import { Cartesian3 } from "@cesium/core";
import { CESIUM_VERSION } from "virtual:cesium/version";

console.log(CESIUM_VERSION);

const widget = new CesiumWidget(document.getElementById("app")!, {
  terrain: Terrain.fromWorldTerrain(),
});
widget.camera.setView({
  destination: Cartesian3.fromDegrees(-75.6, 40.0, 1_500_000),
});

// Cleanup on HMR dispose (dev only)
if (import.meta.hot) {
  import.meta.hot.dispose(() => widget.destroy());
}
