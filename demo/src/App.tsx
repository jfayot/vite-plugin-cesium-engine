import React from "react";
import { CesiumWidget } from "@cesium/engine";
import styles from "./App.module.css";

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

  return <div className={styles.container} ref={viewerRef} />;
};

export default App;
