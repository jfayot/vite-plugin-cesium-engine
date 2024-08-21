import {
  BoundingSphere,
  BoundingSphereState,
  Cartesian3,
  CesiumWidget,
  DataSourceCollection,
  DataSourceDisplay,
  Event,
  JulianDate,
  ModelGraphics,
} from "@cesium/engine";
import rafale from "./resources/Rafale.glb?url";
import sa17 from "./resources/SA-17.glb?url";

export default class Viewer3D {
  private _widget: CesiumWidget;
  private _dataSourceDisplay: DataSourceDisplay;
  private _removeTickCb: Event.RemoveCallback;
  private _removePrerenderCb: Event.RemoveCallback;
  private _flyDone: boolean;

  constructor(cesiumRoot: HTMLDivElement) {
    this._widget = new CesiumWidget(cesiumRoot);
    const scene = this._widget.scene;
    const camera = this._widget.camera;
    const dataSourceCollection = new DataSourceCollection();
    this._dataSourceDisplay = new DataSourceDisplay({
      scene: scene,
      dataSourceCollection: dataSourceCollection,
    });
    const entities = this._dataSourceDisplay.defaultDataSource.entities;
    const rafaleEntity = entities.add({
      position: Cartesian3.fromDegrees(2, 45, 100),
      model: new ModelGraphics({
        uri: rafale,
        minimumPixelSize: 64,
      }),
    });

    entities.add({
      position: Cartesian3.fromDegrees(2, 45, 0),
      model: new ModelGraphics({
        uri: sa17,
        minimumPixelSize: 64,
      }),
    });

    this._removeTickCb = this._widget.clock.onTick.addEventListener((clock) =>
      this._tickHandler(clock.currentTime)
    );

    this._flyDone = false;
    this._removePrerenderCb = scene.preRender.addEventListener(() => {
      if (!this._flyDone) {
        const boundingSphere = new BoundingSphere();
        const trackedState = this._dataSourceDisplay?.getBoundingSphere(
          rafaleEntity,
          false,
          boundingSphere
        );
        if (trackedState === BoundingSphereState.DONE) {
          camera.flyToBoundingSphere(boundingSphere);
          this._flyDone = true;
        }
      }
    });
  }

  public destroy() {
    this._removeTickCb();
    this._removePrerenderCb();
    this._widget.destroy();
  }

  private _tickHandler(currentTime: JulianDate) {
    this._dataSourceDisplay.update(currentTime);
  }
}
