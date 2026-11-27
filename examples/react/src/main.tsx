import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";
import { CesiumWidget, Terrain } from "@cesium/engine";
import { Cartesian3 } from "@cesium/core";
import { CESIUM_VERSION } from "virtual:cesium/version";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    console.log(CESIUM_VERSION);
    const widget = new CesiumWidget(containerRef.current, {
      terrain: Terrain.fromWorldTerrain(),
    });
    widget.camera.setView({
      destination: Cartesian3.fromDegrees(-75.6, 40.0, 1_500_000),
    });
    return () => widget.destroy();
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
