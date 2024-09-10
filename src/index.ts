import type { Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export type PluginCesiumEngineOptions = {
  /**
   * Defines the Cesium's Ion default access token
   *
   * @default undefined
   */
  ionToken?: string;
};

export default function pluginEntry(
  pluginOptions?: PluginCesiumEngineOptions
): Plugin[] {
  const ionToken = pluginOptions?.ionToken;

  let baseUrl = "";

  return [
    ...viteStaticCopy({
      targets: [
        {
          src: "./node_modules/@cesium/engine/Build/*",
          dest: "./cesium/",
        },
        {
          src: "./node_modules/@cesium/engine/Source/Assets/",
          dest: "./cesium/",
        },
        {
          src: "./node_modules/@cesium/engine/Source/Widget/*.css",
          dest: "./cesium/Widget/",
        },
        {
          src: "./node_modules/@cesium/engine/Source/ThirdParty/*.wasm",
          dest: "./cesium/ThirdParty/",
        },
      ],
    }),
    {
      name: "cesium-config",
      config(config) {
        baseUrl = config.base ?? "";
      },
      transform(code, module) {
        if (ionToken !== undefined) {
          const moduleId = this.getModuleInfo(module)?.id;
          // There's probably a better way to do this! If anyone knows, please submit a PR...
          if (
            moduleId?.includes("@cesium/engine/Source/Core/Ion.js") || // Building mode
            moduleId?.includes("@cesium_engine.js") // Serving mode
          ) {
            return code.replace(
              "Ion.defaultAccessToken = defaultAccessToken",
              `Ion.defaultAccessToken = "${ionToken}"`
            );
          }
        }
      },
      transformIndexHtml() {
        return [
          {
            tag: "script",
            attrs: {
              type: "module",
              crossOrigin: true,
            },
            children: `window.CESIUM_BASE_URL = "${baseUrl}/cesium/";`,
          },
          {
            tag: "link",
            attrs: {
              rel: "stylesheet",
              href: `${baseUrl}/cesium/Widget/CesiumWidget.css`,
            },
          },
        ];
      },
    },
  ];
}
