import {
  Cartesian3,
  Cartographic,
  CesiumWidget,
  DebugModelMatrixPrimitive,
  Ellipsoid,
  HeadingPitchRoll,
  ModelGraphics,
  sampleTerrainMostDetailed,
  Terrain,
  Transforms,
} from "@cesium/engine";
import rafale from "./resources/Rafale.glb?url";
import sa17 from "./resources/SA-17.glb?url";

export default class Viewer3D {
  private _widget: CesiumWidget;

  constructor(cesiumRoot: HTMLDivElement) {
    this._widget = new CesiumWidget(cesiumRoot);
    const entities = this._widget.entities;

    const xyz = Cartesian3.fromDegrees(2, 45, 1000);
    const hpr = HeadingPitchRoll.fromDegrees(-15, -20, 10);

    entities.add({
      position: xyz,
      orientation: Transforms.headingPitchRollQuaternion(
        xyz,
        hpr,
        Ellipsoid.WGS84,
        Transforms.localFrameToFixedFrameGenerator("north", "west")
      ),
      model: new ModelGraphics({
        uri: rafale,
        minimumPixelSize: 128,
      }),
    });

    const terrain = Terrain.fromWorldTerrain({
      requestWaterMask: true,
      requestVertexNormals: true,
    });
    this._widget.scene.setTerrain(terrain);

    terrain.readyEvent.addEventListener((provider)=>{
      sampleTerrainMostDetailed(provider, [Cartographic.fromDegrees(2, 45, 0)])
        .then((cartographic) => {
          entities.add({
            position: Cartographic.toCartesian(cartographic[0]),
            model: new ModelGraphics({
              uri: sa17,
              minimumPixelSize: 64,
            }),
          });

          this._widget.flyTo(this._widget.entities);
        })
        .catch((error) => console.log(error));
    })

    this._widget.scene.primitives.add(new DebugModelMatrixPrimitive({
      modelMatrix: Transforms.headingPitchRollToFixedFrame(xyz, new HeadingPitchRoll(), Ellipsoid.WGS84, Transforms.localFrameToFixedFrameGenerator("north", "west")),
      length: 300,
      width: 3
    }))
  }

  public destroy() {
    this._widget.destroy();
  }
}
