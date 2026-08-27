import { CesiumWidget, Terrain } from "@cesium/engine";
import { CESIUM_BASE_URL } from "virtual:cesium";
import { CESIUM_VERSION } from "virtual:cesium/version";

console.log(`Cesium engine ${CESIUM_VERSION}; assets: ${CESIUM_BASE_URL}`);

const widget = new CesiumWidget(document.getElementById("app")!, {
  terrain: Terrain.fromWorldTerrain(),
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => widget.destroy());
}
