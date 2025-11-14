import React from 'react';
import ProjectCanvasMarker from './ProjectCanvasMarker';
import ProjectCanvasLinkLines from './ProjectCanvasLinkLines';
import ProjectLinkedList from './ProjectLinkedList';
import { normalizeId } from '../../utils/panophotoMath';

function ProjectCanvasPanel({
  levels,
  resolvedActiveLevelId,
  isLevelRequestPending,
  onSelectLevel,
  onAddLevel,
  onRenameLevel,
  onRemoveLevel,
  canvasRef,
  shouldShowBackground,
  resolvedBackgroundUrl,
  canvasPaddingStyle,
  onCanvasClick,
  linkLines,
  visiblePhotos,
  resolvedActiveLevelStartPhotoId,
  selectedPhotoId,
  linkSourceId,
  draggingPhotoId,
  showCanvasLabels,
  onMarkerClick,
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  onLinkButtonClick,
  isLinkPending,
  onSetLevelStartPhoto,
  isSelectedOnActiveLevel,
  isLevelStartPending,
  isSelectedStoredLevelStart,
  onUnplacePhoto,
  onToggleCanvasLabels,
  linkingSourcePhoto,
  selectedPhoto,
  photos,
  onUnlinkPhoto,
}) {
  const safeLevels = Array.isArray(levels) ? levels : [];
  const safePhotos = Array.isArray(visiblePhotos) ? visiblePhotos : [];
  const normalizedSelectedId = normalizeId(selectedPhotoId);
  const normalizedLinkSourceId = normalizeId(linkSourceId);
  const isLinkModeActive = Boolean(normalizedLinkSourceId);
  const canRemoveLevel = safeLevels.length > 1;

  return (
    <div className="project-canvas-wrapper">
      <div className="project-level-tabs">
        <div className="project-level-tab-list">
          {safeLevels.map((level) => {
            const levelId = normalizeId(level?._id);
            const isActive = levelId && levelId === resolvedActiveLevelId;

            return (
              <button
                type="button"
                key={level._id || levelId}
                className={`project-level-tab${isActive ? ' active' : ''}`}
                onClick={() => onSelectLevel(levelId)}
                disabled={!levelId || (isLevelRequestPending && !isActive)}
              >
                {level?.name || 'Level'}
              </button>
            );
          })}
          <button
            type="button"
            className="project-level-tab add"
            onClick={onAddLevel}
            disabled={isLevelRequestPending}
          >
            + Add Level
          </button>
        </div>
        <div className="project-level-tab-actions">
          <button
            type="button"
            onClick={onRenameLevel}
            disabled={!resolvedActiveLevelId || isLevelRequestPending}
          >
            Rename Level
          </button>
          <button
            type="button"
            onClick={onRemoveLevel}
            disabled={!resolvedActiveLevelId || isLevelRequestPending || !canRemoveLevel}
          >
            Remove Level
          </button>
        </div>
      </div>

      <div
        className={`project-canvas${shouldShowBackground ? ' has-background' : ''}`}
        ref={canvasRef}
        style={canvasPaddingStyle}
        onClick={onCanvasClick}
      >
        {shouldShowBackground && resolvedBackgroundUrl ? (
          <div
            className="project-canvas-background"
            style={{ backgroundImage: `url(${resolvedBackgroundUrl})` }}
          />
        ) : null}

        <ProjectCanvasLinkLines segments={linkLines} />

        {safePhotos.map((photo) => {
          const isLevelStart = photo._id === resolvedActiveLevelStartPhotoId;
          const startBadge = isLevelStart ? 'Start' : null;

          return (
            <ProjectCanvasMarker
              key={photo._id}
              label={photo.name}
              x={photo.xPosition ?? 0}
              y={photo.yPosition ?? 0}
              isSelected={photo._id === normalizedSelectedId}
              isLinkSource={photo._id === normalizedLinkSourceId}
              startBadge={startBadge}
              isDragging={photo._id === draggingPhotoId}
              showLabel={showCanvasLabels}
              onClick={(event) => onMarkerClick(event, photo._id)}
              onDragStart={(event) => onMarkerDragStart(event, photo._id)}
              onDrag={(event) => onMarkerDrag(event, photo._id)}
              onDragEnd={(event, metadata) => onMarkerDragEnd(event, metadata, photo._id)}
            />
          );
        })}
      </div>

      <div className="project-canvas-actions">
        <button
          type="button"
          className={`project-link-button${isLinkModeActive ? ' active' : ''}`}
          onClick={onLinkButtonClick}
          disabled={!selectedPhotoId || isLinkPending}
        >
          {isLinkModeActive ? 'Cancel Linking' : 'Link Photos'}
        </button>
        <button
          type="button"
          onClick={onSetLevelStartPhoto}
          disabled={!isSelectedOnActiveLevel || isLevelStartPending}
        >
          {isSelectedStoredLevelStart ? 'Level Start' : 'Set Level Start'}
        </button>
        <button type="button" onClick={onUnplacePhoto} disabled={!selectedPhotoId}>
          Remove From Canvas
        </button>
        <label>
          <input type="checkbox" checked={showCanvasLabels} onChange={onToggleCanvasLabels} /> Show Labels
        </label>
      </div>

      <ProjectLinkedList
        selectedPhoto={selectedPhoto}
        photos={photos}
        isLinkPending={isLinkPending}
        onUnlinkPhoto={onUnlinkPhoto}
      />

      {linkingSourcePhoto ? (
        <p className="project-link-hint">
          Select another photo to link with "{linkingSourcePhoto.name}".
        </p>
      ) : null}

      <p className="canvas-helper-text">
        Select a photo, click the canvas to place it on this level, or drag existing markers to refine positions.
      </p>
    </div>
  );
}

export default ProjectCanvasPanel;
