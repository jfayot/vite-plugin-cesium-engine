# vite-plugin-cesium-engine

## 1.5.0

### Minor Changes

- [`944e58e`](https://github.com/jfayot/vite-plugin-cesium-engine/commit/944e58e1066e823078c2e14d9b229779a41a93ff) - Changed CESIUM_BASE_URL handling and removed pointless CSP options

## 1.4.1

### Patch Changes

- [`6756006`](https://github.com/jfayot/vite-plugin-cesium-engine/commit/67560067960bda6a198075a19cbf83c77b739a0b) - Fixed missing node:crypto external

## 1.4.0

### Minor Changes

- [`f15befd`](https://github.com/jfayot/vite-plugin-cesium-engine/commit/f15befd27400e19c2828f9a24c954a0459084fac) - Added inline script SHA-256 hashes extraction for CSP whitelisting

## 1.3.1

### Patch Changes

- [`9e4f0d2`](https://github.com/jfayot/vite-plugin-cesium-engine/commit/9e4f0d2dc1b2e317cd164f719494e81253803fe4) - Updated README

## 1.3.0

### Minor Changes

- [`89f527c`](https://github.com/jfayot/vite-plugin-cesium-engine/commit/89f527cd74dcca05b88d485be2bdb11fc1419a16) - Added virtual:cesium/version virtual module

## 1.2.4

### Patch Changes

- PR #122 from @etuardu: Fixed typo in README

## 1.2.3

### Patch Changes

- Fixed type def path

## 1.2.2

### Patch Changes

- Fixed gh security alert

## 1.2.1

### Patch Changes

- Added examples

## 1.2.0

### Minor Changes

- Added cesiumBaseUrl, assetsPath and debug options

## 1.1.9

### Patch Changes

- Updated dependencies

## 1.1.8

### Patch Changes

- Inverted vite static copy targets to workaround https://github.com/sapphi-red/vite-plugin-static-copy/issues/151

## 1.1.7

### Patch Changes

- Fixed package manager

## 1.1.6

### Patch Changes

- Updated dependencies

## 1.1.5

### Patch Changes

- Updated demo

## 1.1.4

### Patch Changes

- Updated dependencies

## 1.1.3

### Patch Changes

- Let the plugin consumer decide its manual chunk strategy

## 1.1.2

### Patch Changes

- Changed cesium's manual chunk to callable for some frameworks (e.g. Vike)"

## 1.1.1

### Patch Changes

- Added wasm files for draco compressed models

## 1.1.0

### Minor Changes

- Got rid of esm.sh

## 1.0.3

### Patch Changes

- Fixed issue when base is defined in vite config

## 1.0.2

### Patch Changes

- Fixed README

## 1.0.1

### Patch Changes

- Fixed issue when ionToken option is undefined

## 1.0.0

### Major Changes

- Added plugin options: cesiumEngineVersion and ionToken
