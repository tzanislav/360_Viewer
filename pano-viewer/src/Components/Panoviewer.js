import {  ReactPhotoSphereViewer} from "react-photo-sphere-viewer";
import React from "react";
import "../CSS/styles.css";

function Panoviewer() {

    console.log("Panoviewer component rendered");
  const handleClick = (data) => {
    console.log("Clicked on panorama:", data);
  };

  console.log("Setting up error handler");

  const handleError = (error) => {
    console.error("PhotoSphere Error:", error);
    console.error("Error details:", {
      message: error?.message,
      type: error?.type,
      target: error?.target,
      stack: error?.stack
    });
  };

  console.log("Setting up ready handler");

  const handleReady = () => {
    console.log("PhotoSphere viewer is ready");
  };

  console.log("Rendering ReactPhotoSphereViewer component");

  return (
    <div className="App">
      <ReactPhotoSphereViewer
        src="https://static.vecteezy.com/system/resources/previews/010/387/128/large_2x/empty-white-room-without-furniture-full-spherical-hdri-panorama-360-degrees-in-interior-room-in-modern-apartments-office-or-clinic-in-equirectangular-projection-photo.jpg"
        height={"100vh"}
        width={"100%"}
        littlePlanet={false}
        onClick={handleClick}
        onError={handleError}
        onReady={handleReady}
      ></ReactPhotoSphereViewer>
    </div>
  );
}

export default Panoviewer;