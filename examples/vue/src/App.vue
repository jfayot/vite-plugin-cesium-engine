<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { CesiumWidget, Terrain } from "@cesium/engine";
import { CESIUM_VERSION } from "virtual:cesium/version";

const container = ref<HTMLDivElement>();
let widget: CesiumWidget;

onMounted(() => {
  console.log(CESIUM_VERSION);
  widget = new CesiumWidget(container.value!, {
    terrain: Terrain.fromWorldTerrain(),
  });
});

onBeforeUnmount(() => {
  widget?.destroy();
});
</script>

<template>
  <div ref="container" style="width: 100%; height: 100%" />
</template>