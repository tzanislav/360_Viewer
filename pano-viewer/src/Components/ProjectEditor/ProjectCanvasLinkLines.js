import React from 'react';
import '../../CSS/styles.css';

function ProjectCanvasLinkLines({ segments }) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  return (
    <svg className="project-canvas-links" viewBox="0 0 100 100" preserveAspectRatio="none">
      {segments.map((segment) => (
        <line
          key={segment.id}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          className="project-canvas-link-line"
        />
      ))}
    </svg>
  );
}

export default ProjectCanvasLinkLines;
