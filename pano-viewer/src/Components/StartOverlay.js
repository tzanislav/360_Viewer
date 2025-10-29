import React from "react";
import "../CSS/StartOverlay.css";

function StartOverlay({ onStart }) {
  return (
    <div className="start-overlay">
      <div className="start-overlay-content">
        <h1>Welcome to Pano Viewer</h1>
        <p>Experience immersive 360° panoramic views</p>
        <button className="start-button" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  );
}

export default StartOverlay;