import React from 'react';
import '../CSS/styles.css';

function ProjectCanvasMarker({
  label,
  x = 0,
  y = 0,
  isSelected = false,
  isLinkSource = false,
  isStart = false,
  onClick,
}) {
  const name = label || 'Photo';
  const classNames = [
    'project-canvas-marker',
    isSelected ? 'selected' : '',
    isLinkSource ? 'linking-source' : '',
    isStart ? 'start' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const clampedX = Math.max(0, Math.min(1, x));
  const clampedY = Math.max(0, Math.min(1, y));

  const style = {
    left: `${clampedX * 100}%`,
    top: `${clampedY * 100}%`,
  };

  const handleClick = (event) => {
    if (typeof onClick === 'function') {
      onClick(event);
    }
  };

  return (
    <div className={classNames} style={style} title={name} onClick={handleClick}>
      {isStart ? <span className="project-canvas-start-badge">Start</span> : null}
      <div className="project-canvas-dot" />
      <span className="project-canvas-label">{name}</span>
    </div>
  );
}

export default ProjectCanvasMarker;
