<script lang="ts">
  import { onMount } from "svelte";
  import { CesiumWidget, Terrain } from "@cesium/engine";

  let container: HTMLDivElement;

  onMount(() => {
    const widget = new CesiumWidget(container, {
      terrain: Terrain.fromWorldTerrain(),
    });
    return () => widget.destroy();
  });
</script>

<div bind:this={container} style="width: 100%; height: 100%" />