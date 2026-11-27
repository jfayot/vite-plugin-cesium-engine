<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { CesiumWidget, Terrain } from "@cesium/engine";
import { Cartesian3 } from "@cesium/core";
import { CESIUM_VERSION } from "virtual:cesium/version";

const container = ref<HTMLDivElement>();
let widget: CesiumWidget;

onMounted(() => {
  console.log(CESIUM_VERSION);
  widget = new CesiumWidget(container.value!, {
    terrain: Terrain.fromWorldTerrain(),
  });
  widget.camera.setView({
    destination: Cartesian3.fromDegrees(-75.6, 40.0, 1_500_000),
  });
});

onBeforeUnmount(() => {
  widget?.destroy();
});
</script>

<template>
  <div ref="container" style="width: 100%; height: 100%" />
</template>
