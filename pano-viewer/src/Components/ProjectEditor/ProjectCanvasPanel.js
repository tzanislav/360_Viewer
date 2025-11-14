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
  canvasRef,
  shouldShowBackground,
  resolvedBackgroundUrl,
  canvasPaddingStyle,
  onCanvasClick,
  linkLines,
  visiblePhotos,
  resolvedStartPhotoId,
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
  onSetStartPhoto,
  isSelectedStoredStart,
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
          const isProjectStart = photo._id === resolvedStartPhotoId;
          const isLevelStart = photo._id === resolvedActiveLevelStartPhotoId;
          const startBadge = isProjectStart ? 'Project Start' : isLevelStart ? 'Level Start' : null;

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
        <button type="button" onClick={onLinkButtonClick} disabled={isLinkPending || !selectedPhotoId || !linkingSourcePhoto}>
          {linkingSourcePhoto ? 'Click destination photo' : 'Link Photos'}
        </button>
        <button
          type="button"
          onClick={onSetLevelStartPhoto}
          disabled={!isSelectedOnActiveLevel || isLevelStartPending}
        >
          {isSelectedStoredLevelStart ? 'Active Level Start Scene' : 'Set Level Start Scene'}
        </button>
        <button type="button" onClick={onSetStartPhoto} disabled={!selectedPhotoId}>
          {isSelectedStoredStart ? 'Global Start Scene' : 'Set Global Start Scene'}
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
