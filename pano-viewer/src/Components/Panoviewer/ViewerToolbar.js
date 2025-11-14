import React from 'react';
import PropTypes from 'prop-types';

function ViewerToolbar({
  onBack,
  onToggleAdjustMode,
  isAdjustModeActive,
  isSavingOffset,
  panophoto,
  levelOptions,
  isLoadingLevels,
  effectiveLevelValue,
  onLevelChange,
}) {
  return (
    <div className="viewer-toolbar">
      <button type="button" className="viewer-editor-button" onClick={onBack}>
        Back to Editor
      </button>
      <button
        type="button"
        className={`viewer-editor-button adjust-toggle${isAdjustModeActive ? ' active' : ''}`}
        onClick={onToggleAdjustMode}
        disabled={!panophoto?.linkedPhotos?.length || isSavingOffset}
      >
        {isAdjustModeActive ? 'Done Adjusting Markers' : 'Adjust Marker Positions'}
      </button>
      <div className="viewer-level-selector">
        <label>
          <span>Level</span>
          <select
            value={effectiveLevelValue}
            onChange={onLevelChange}
            disabled={isLoadingLevels || levelOptions.length === 0}
          >
            <option value="unplaced">{isLoadingLevels ? 'Loading…' : 'Select level'}</option>
            {levelOptions.map((option) => (
              <option
                key={option.id || option.name}
                value={option.id || ''}
                disabled={!option.firstPhotoId}
              >
                {option.name}
                {!option.firstPhotoId ? ' (empty)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

ViewerToolbar.propTypes = {
  onBack: PropTypes.func.isRequired,
  onToggleAdjustMode: PropTypes.func.isRequired,
  isAdjustModeActive: PropTypes.bool.isRequired,
  isSavingOffset: PropTypes.bool.isRequired,
  panophoto: PropTypes.shape({
    linkedPhotos: PropTypes.arrayOf(PropTypes.any),
  }),
  levelOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      firstPhotoId: PropTypes.string,
    })
  ).isRequired,
  isLoadingLevels: PropTypes.bool.isRequired,
  effectiveLevelValue: PropTypes.string.isRequired,
  onLevelChange: PropTypes.func.isRequired,
};

ViewerToolbar.defaultProps = {
  panophoto: null,
};

export default ViewerToolbar;
