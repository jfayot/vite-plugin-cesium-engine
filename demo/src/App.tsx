import React from "react";
import Viewer3D from "./viewer3D";
import styles from "./App.module.css";

const App: React.FC = () => {
  const divRef = React.useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = React.useState<Viewer3D | null>(null);

  React.useEffect(() => {
    if (divRef.current) {
      setViewer(new Viewer3D(divRef.current));
    }

    return () => {
      viewer?.destroy();
      setViewer(null);
    };
  }, [divRef]);

  return <div className={styles.container} ref={divRef} />;
};

export default App;
