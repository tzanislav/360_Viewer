import React from 'react';
import '../CSS/styles.css';

function ProjectPhotoThumbnail({
  label,
  imageUrl,
  isSelected = false,
  isLinkSource = false,
  isStart = false,
  isBusy = false,
  onClick,
  onDelete,
}) {
  const name = label || 'Photo';
  const classNames = [
    'project-photo-thumb',
    isSelected ? 'selected' : '',
    isLinkSource ? 'linking-source' : '',
    isStart ? 'start' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined;

  const handleThumbnailClick = (event) => {
    if (typeof onClick === 'function') {
      onClick(event);
    }
  };

  const handleDeleteClick = (event) => {
    event.stopPropagation();
    event.preventDefault();

    if (isBusy) {
      return;
    }

    if (typeof onDelete === 'function') {
      onDelete(event);
    }
  };

  return (
    <div className="project-photo-thumb-container">
      {isStart ? <span className="project-photo-thumb-badge">Start</span> : null}
      <button type="button" className={classNames} onClick={handleThumbnailClick} style={style} disabled={isBusy}>
        <span>{name}</span>
      </button>
      {onDelete ? (
        <button
          type="button"
          className="project-photo-thumb-delete"
          onClick={handleDeleteClick}
          disabled={isBusy}
          aria-label={`Delete ${name}`}
          title="Delete photo"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export default ProjectPhotoThumbnail;
