# vite-plugin-cesium-engine

Yet another Vite.js plugin for Cesium.js !

Inspired from [vite-plugin-cesium](https://github.com/nshen/vite-plugin-cesium/) and [vite-plugin-cesium-build](https://github.com/s3xysteak/vite-plugin-cesium-build) this one aims at providing a plug-and-play plugin for the [@cesium/engine](https://www.npmjs.com/package/@cesium/engine) package **only**: no widget at all, except the mandatory [CesiumWidget](https://cesium.com/learn/cesiumjs/ref-doc/CesiumWidget.html)

It relies on [esm.sh](https://esm.sh) modern CDN to import cesium's engine as ES6+ module.

No need to import CesiumWidget.css, no need to declare CESIUM_BASE_URL, the plugin does this for you.

All you need to do is to provide the plugin to your vite config file:

`vite.config.ts`

```javascript
import { defineConfig } from "vite";
import cesiumEngine from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [cesiumEngine()],
});
```

... and play with Cesium:

`App.tsx`

```javascript
import { CesiumWidget, Ion } from "@cesium/engine";

Ion.defaultAccessToken = "DON_T_FORGET_TO_PUT_YOUR_OWN_ION_TOKEN_HERE";

const App: React.FC = () => {
  const viewerRef = React.useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = React.useState<CesiumWidget|null>(null);

  React.useEffect(() => {
    if (viewerRef.current && !viewer) {
      setViewer(new CesiumWidget(viewerRef.current));
    }

    return () => {
      viewer?.destroy();
      setViewer(null);
    };
  }, [viewerRef]);

  return <div style={{ width: "100%", height: "100%" }} ref={viewerRef} />;
};

export default App;
```
