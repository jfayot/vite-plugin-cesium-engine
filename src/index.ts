import type { Plugin, UserConfig, HtmlTagDescriptor } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export type PluginCesiumEngineOptions = {
  /**
   * Defines the @cesium/engine semver to import
   *
   * @default: "latest"
   */
  cesiumEngineVersion?: string;
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
  const options: PluginCesiumEngineOptions = {
    cesiumEngineVersion: pluginOptions?.cesiumEngineVersion ?? "latest",
    ionToken: pluginOptions?.ionToken,
  };

  let ionTokenFile: string | undefined = undefined;
  let serving = false;
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
      ],
    }),
    {
      name: "cesium-config",
      config(config, env) {
        if (env.command === "serve") serving = true;

        baseUrl = config.base ?? "";
        console.log("config.base: " + config.base);
        console.log("baseUrl: " + baseUrl);

        const userConfig: UserConfig = {
          build: {
            rollupOptions: {
              external: ["http", "https", "url", "zlib"],
            },
          },
          resolve: {
            alias: {
              "@cesium/engine": `https://esm.sh/@cesium/engine@${options.cesiumEngineVersion}`,
            },
          },
        };

        return userConfig;
      },
      generateBundle() {
        if (options.ionToken !== undefined) {
          const id = this.emitFile({
            type: "asset",
            name: "ionToken.js",
            source: `import { Ion } from "https://esm.sh/@cesium/engine@${options.cesiumEngineVersion}";Ion.defaultAccessToken = "${options.ionToken}";`,
          });
          ionTokenFile = this.getFileName(id);
        }
      },
      transformIndexHtml() {
        const tags: HtmlTagDescriptor[] = [
          {
            tag: "script",
            attrs: {
              type: "module",
              crossOriginIsolated: true,
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

        if (options.ionToken !== undefined) {
          if (serving) {
            tags.push({
              tag: "script",
              attrs: {
                type: "module",
                crossOriginIsolated: true,
              },
              children: `import { Ion } from "https://esm.sh/@cesium/engine@${options.cesiumEngineVersion}";Ion.defaultAccessToken = "${options.ionToken}";`,
            });
          } else {
            tags.push({
              tag: "script",
              attrs: {
                type: "module",
                crossOriginIsolated: true,
                src: ionTokenFile,
              },
            });
          }
        }

        return tags;
      },
    },
  ];
}
