import React from "react";
import { CesiumWidget, Ion } from "@cesium/engine";

Ion.defaultAccessToken = "YOUR_OWN_ION_TOKEN";

const App: React.FC = () => {
  const viewerRef = React.useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = React.useState<CesiumWidget | null>(null);

  React.useEffect(() => {
    if (viewerRef.current && !viewer) {
      setViewer(new CesiumWidget(viewerRef.current));
    }

    return () => {
      viewer?.destroy();
      setViewer(null);
    };
  }, [viewerRef]);

  return <div style={{ width: "100%", height: "100%" }} ref={viewerRef} />;
};

export default App;
