import { ReactPhotoSphereViewer } from "react-photo-sphere-viewer";
import { CompassPlugin } from "@photo-sphere-viewer/compass-plugin";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import '@photo-sphere-viewer/compass-plugin/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import React from "react";
import { useLocation } from "react-router-dom";

function Panoviewer() {
  const location = useLocation();
  const stateSource = location.state?.src;
  const params = new URLSearchParams(location.search);
  const querySource = params.get('src');
  const source = stateSource || querySource || 'testPanorama.jpg';

  console.log('Panoviewer source URL:', source);

  const handleReady = (instance) => {
    const markersPlugin = instance.getPlugin(MarkersPlugin);
    if (!markersPlugin) {
      console.warn('MarkersPlugin not available on viewer instance');
      return;
    }

    markersPlugin.addEventListener('select-marker', (event) => {
      const markerId = event?.marker?.id ?? 'unknown';
      console.log(`Marker clicked: ${markerId}`);
    });
  };

  const plugins = [
    [
      CompassPlugin,
      {

      },
    ],
    [
      MarkersPlugin,
      {
        markers: [
          {
            id: "imageLayer2",
            image: "drone.png",
            size: { width: 64, height: 64 },
            position: { yaw: "130.5deg", pitch: "-0.1deg" },
            tooltip: "Image embedded in the scene",
          },
        ],
      },
    ],
  ];

  return (
    <div className="App">
      <ReactPhotoSphereViewer
        src={source}
        plugins={plugins}
        height={"100vh"}
        width={"100%"}
        onReady={handleReady}
      ></ReactPhotoSphereViewer>
    </div>
  );
}

export default Panoviewer;