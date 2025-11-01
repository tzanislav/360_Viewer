import React, { useRef } from 'react';
import '../CSS/styles.css';

function ProjectCanvasMarker({
  label,
  x = 0,
  y = 0,
  isSelected = false,
  isLinkSource = false,
  isStart = false,
  isDragging = false,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd,
}) {
  const name = label || 'Photo';
  const pointerCapturedRef = useRef(false);

  const classNames = [
    'project-canvas-marker',
    isSelected ? 'selected' : '',
    isLinkSource ? 'linking-source' : '',
    isStart ? 'start' : '',
    isDragging ? 'dragging' : '',
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

  const handlePointerDown = (event) => {
    if (typeof onDragStart !== 'function') {
      return;
    }

    const shouldCapture = onDragStart(event) !== false;

    if (shouldCapture) {
      pointerCapturedRef.current = true;
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } else {
      pointerCapturedRef.current = false;
    }
  };

  const handlePointerMove = (event) => {
    if (!pointerCapturedRef.current) {
      return;
    }

    if (typeof onDrag === 'function') {
      onDrag(event);
    }
  };

  const releasePointer = (target, pointerId) => {
    if (target && target.hasPointerCapture && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  };

  const handlePointerUp = (event) => {
    if (!pointerCapturedRef.current) {
      return;
    }

    pointerCapturedRef.current = false;
    releasePointer(event.currentTarget, event.pointerId);

    if (typeof onDragEnd === 'function') {
      onDragEnd(event, { cancelled: false });
    }
  };

  const handlePointerCancel = (event) => {
    if (!pointerCapturedRef.current) {
      return;
    }

    pointerCapturedRef.current = false;
    releasePointer(event.currentTarget, event.pointerId);

    if (typeof onDragEnd === 'function') {
      onDragEnd(event, { cancelled: true });
    }
  };

  return (
    <div
      className={classNames}
      style={style}
      title={name}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {isStart ? <span className="project-canvas-start-badge">Start</span> : null}
      <div className="project-canvas-dot" />
      <span className="project-canvas-label">{name}</span>
    </div>
  );
}

export default ProjectCanvasMarker;
