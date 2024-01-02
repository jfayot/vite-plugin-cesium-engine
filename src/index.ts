import type { Plugin, UserConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default function pluginEntry(): Plugin[] {
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
      transformIndexHtml: () => [
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "/cesium/Widget/CesiumWidget.css",
          },
        },
      ],
      config: () => {
        const userConfig: UserConfig = {
          define: {
            CESIUM_BASE_URL: JSON.stringify("/cesium/"),
          },
          build: {
            rollupOptions: {
              external: ["http", "https", "url", "zlib"],
              output: {
                intro: `window.CESIUM_BASE_URL = "/cesium/";`,
              },
            },
          },
          resolve: {
            alias: {
              "@cesium/engine": "https://esm.sh/@cesium/engine",
            },
          },
        };

        return userConfig;
      },
    },
  ];
}
