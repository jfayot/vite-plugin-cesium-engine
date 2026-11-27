import { CesiumWidget, Terrain } from "@cesium/engine";
import { Cartesian3 } from "@cesium/core";
import { CESIUM_BASE_URL } from "virtual:cesium";
import { CESIUM_VERSION } from "virtual:cesium/version";

console.log(`Cesium engine ${CESIUM_VERSION}; assets: ${CESIUM_BASE_URL}`);

const widget = new CesiumWidget(document.getElementById("app")!, {
  terrain: Terrain.fromWorldTerrain(),
});
widget.camera.setView({
  destination: Cartesian3.fromDegrees(-75.6, 40.0, 1_500_000),
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => widget.destroy());
}
