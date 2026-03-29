<script lang="ts">
  import { onMount } from "svelte";
  import { CesiumWidget, Terrain } from "@cesium/engine";
  import { CESIUM_VERSION } from "virtual:cesium/version";

  let container: HTMLDivElement;

  onMount(() => {
    console.log(CESIUM_VERSION);
    const widget = new CesiumWidget(container, {
      terrain: Terrain.fromWorldTerrain(),
    });
    return () => widget.destroy();
  });
</script>

<div bind:this={container} style="width: 100%; height: 100%" />