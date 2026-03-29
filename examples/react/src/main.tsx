import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";
import { CesiumWidget, Terrain } from "@cesium/engine";
import { CESIUM_VERSION } from "virtual:cesium/version";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    console.log(CESIUM_VERSION);
    const widget = new CesiumWidget(containerRef.current, {
      terrain: Terrain.fromWorldTerrain(),
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
