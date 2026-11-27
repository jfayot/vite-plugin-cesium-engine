<script lang="ts">
  import { onMount } from "svelte";
  import { CesiumWidget, Terrain } from "@cesium/engine";
  import { Cartesian3 } from "@cesium/core";
  import { CESIUM_VERSION } from "virtual:cesium/version";

  let container: HTMLDivElement;

  onMount(() => {
    console.log(CESIUM_VERSION);
    const widget = new CesiumWidget(container, {
      terrain: Terrain.fromWorldTerrain(),
    });
    widget.camera.setView({
      destination: Cartesian3.fromDegrees(-75.6, 40.0, 1_500_000),
    });
    return () => widget.destroy();
  });
</script>

<div bind:this={container} style="width: 100%; height: 100%" ></div>
