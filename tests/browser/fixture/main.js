import { CesiumWidget, PerInstanceColorAppearance, Primitive } from "@cesium/engine";
import {
  BoxGeometry,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  Matrix4,
} from "@cesium/core";

const status = document.getElementById("status");
const widget = new CesiumWidget("app", {
  baseLayer: false,
  skyBox: false,
  skyAtmosphere: false,
  contextOptions: { webgl: { preserveDrawingBuffer: true } },
});
widget.scene.renderError.addEventListener((_scene, error) => {
  status.textContent = error.message;
  console.error(error);
});

const box = widget.scene.primitives.add(
  new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: BoxGeometry.fromDimensions({
        dimensions: new Cartesian3(400_000, 400_000, 400_000),
        vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
      }),
      modelMatrix: Matrix4.fromTranslation(Cartesian3.fromDegrees(0, 0, 300_000)),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.RED) },
    }),
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: false }),
    asynchronous: true,
  }),
);
widget.camera.setView({ destination: Cartesian3.fromDegrees(0, 0, 2_000_000) });
widget.scene.postRender.addEventListener(() => {
  if (box.ready) status.textContent = "ready";
});
