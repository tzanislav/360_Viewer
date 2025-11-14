import React, { useMemo } from 'react';
import ProjectPhotoThumbnail from './ProjectPhotoThumbnail';
import '../../CSS/styles.css';

function defaultNormalizeId(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (!value) {
    return '';
  }

  if (typeof value === 'object' && value.target !== undefined) {
    return defaultNormalizeId(value.target);
  }

  if (typeof value === 'object' && value._id) {
    if (typeof value._id.toHexString === 'function') {
      return value._id.toHexString();
    }

    if (typeof value._id.toString === 'function') {
      return value._id.toString();
    }
  }

  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return '';
}

function ProjectPhotoBrowser({
  photos = [],
  selectedPhotoId,
  linkSourceId,
  deletingPhotoIds = [],
  resolvedActiveLevelId,
  levelNameById,
  levelStartPhotoIdMap,
  onSelectPhoto,
  onDeletePhoto,
  normalizeId = defaultNormalizeId,
}) {
  const deletingPhotoIdSet = useMemo(() => new Set(deletingPhotoIds), [deletingPhotoIds]);

  return (
    <aside className="project-photo-browser">
      {photos.length === 0 ? (
        <p className="panophoto-status">No photos in this project yet.</p>
      ) : (
        <div className="project-photo-browser-grid">
          {photos.map((photo) => {
            const imageUrl = photo.thumbnailUrl || photo.imageUrl;
            const isDeleting = deletingPhotoIdSet.has(photo._id);
            const photoLevelId = normalizeId(photo.levelId);
            const placementLabel = photoLevelId
              ? levelNameById?.get?.(photoLevelId) || 'Unknown level'
              : 'Not placed';
            const isInactivePlacement = Boolean(
              photoLevelId && resolvedActiveLevelId && photoLevelId !== resolvedActiveLevelId
            );
            const isUnplaced = !photoLevelId;
            const levelStartId = photoLevelId
              ? levelStartPhotoIdMap?.get?.(photoLevelId) || null
              : null;
            const isLevelStart = Boolean(levelStartId && levelStartId === photo._id);
            const startBadge = isLevelStart ? 'Start' : null;

            return (
              <ProjectPhotoThumbnail
                key={photo._id}
                label={photo.name}
                imageUrl={imageUrl}
                isSelected={photo._id === selectedPhotoId}
                isLinkSource={linkSourceId === photo._id}
                startBadge={startBadge}
                isBusy={isDeleting}
                placementLabel={placementLabel}
                isInactivePlacement={isInactivePlacement}
                isUnplaced={isUnplaced}
                onClick={() => onSelectPhoto?.(photo._id)}
                onDelete={onDeletePhoto ? () => onDeletePhoto(photo._id) : undefined}
              />
            );
          })}
        </div>
      )}
    </aside>
  );
}

export default ProjectPhotoBrowser;
