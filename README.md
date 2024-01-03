# vite-plugin-cesium-engine

[![npm](https://img.shields.io/npm/v/vite-plugin-cesium-engine.svg)](https://www.npmjs.com/package/vite-plugin-cesium-engine)

Yet another Vite.js plugin for Cesium.js !

Inspired from [vite-plugin-cesium](https://github.com/nshen/vite-plugin-cesium/) and [vite-plugin-cesium-build](https://github.com/s3xysteak/vite-plugin-cesium-build) this one aims at providing a plug-and-play plugin for the [@cesium/engine](https://www.npmjs.com/package/@cesium/engine) package **only**: no widget at all, except the mandatory [CesiumWidget](https://cesium.com/learn/cesiumjs/ref-doc/CesiumWidget.html)

It relies on [esm.sh](https://esm.sh) modern CDN to import cesium's engine as ES6+ module.

## Install

```bash
npm i -D @cesium/engine vite-plugin-cesium-engine
# pnpm add -D @cesium/engine vite-plugin-cesium-engine
```

## Usage

No need to import CesiumWidget.css, no need to declare CESIUM_BASE_URL, the plugin does this for you.

All you need to do is to provide the plugin to your vite config file:

`vite.config.ts`

```javascript
import { defineConfig } from "vite";
import cesiumEngine from "vite-plugin-cesium-engine";

export default defineConfig({
  plugins: [cesiumEngine(
    cesiumEngineVersion: "^6.2.0",
    ionToken: "DONT_FORGET_TO_SET_YOUR_OWN_ION_ACCESS_TOKEN_HERE",
  )],
});
```

... and play with Cesium:

`App.tsx`

```javascript
import { CesiumWidget } from "@cesium/engine";

const App: React.FC = () => {
  const viewerRef = React.useRef < HTMLDivElement > null;
  const [viewer, setViewer] = (React.useState < CesiumWidget) | (null > null);

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

## Plugin options

### cesiumEngineVersion

- **Type :** `string`
- **Default :** `latest`

Semver version of @cesium/engine to import from [ESM.sh](esm.sh)

### ionToken

- **Type :** `string`
- **Default :** `empty`

Defines the Cesium's Ion access token
