import React from 'react';
import '../CSS/styles.css';

function ProjectPhotoThumbnail({
  label,
  imageUrl,
  isSelected = false,
  isLinkSource = false,
  isStart = false,
  isBusy = false,
  placementLabel,
  isInactivePlacement = false,
  isUnplaced = false,
  onClick,
  onDelete,
}) {
  const name = label || 'Photo';
  const classNames = [
    'project-photo-thumb',
    isSelected ? 'selected' : '',
    isLinkSource ? 'linking-source' : '',
    isStart ? 'start' : '',
    isInactivePlacement ? 'inactive-placement' : '',
    isUnplaced ? 'unplaced' : '',
    !imageUrl ? 'no-image' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const containerClassNames = [
    'project-photo-thumb-container',
    isInactivePlacement ? 'inactive' : '',
    isUnplaced ? 'unplaced' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
    <div className={containerClassNames}>
      {isStart ? <span className="project-photo-thumb-badge">Start</span> : null}
      <button type="button" className={classNames} onClick={handleThumbnailClick} disabled={isBusy}>
        {imageUrl ? (
          <span className="project-photo-thumb-image-wrapper" aria-hidden="true">
            <img src={imageUrl} alt="" className="project-photo-thumb-image" loading="lazy" />
          </span>
        ) : null}
        <span className="project-photo-thumb-label">{name}</span>
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
      {placementLabel ? (
        <span className="project-photo-thumb-placement">{placementLabel}</span>
      ) : null}
    </div>
  );
}

export default ProjectPhotoThumbnail;
