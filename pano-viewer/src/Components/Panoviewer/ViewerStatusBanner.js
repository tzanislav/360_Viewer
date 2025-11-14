import React from 'react';
import PropTypes from 'prop-types';

function ViewerStatusBanner({
  errorMessage,
  levelsError,
  isFetching,
  panophoto,
  statusMessage,
  isSavingOffset,
  selectedMarkerLabel,
}) {
  return (
    <>
      {errorMessage ? <p className="panophoto-status error">{errorMessage}</p> : null}
      {levelsError ? <p className="panophoto-status error">{levelsError}</p> : null}
      {isFetching && !panophoto ? <p className="panophoto-status">Loading…</p> : null}
      {statusMessage ? (
        <p className={`panophoto-status${isSavingOffset ? ' pending' : ''}`}>
          {statusMessage}
          {selectedMarkerLabel ? ` — ${selectedMarkerLabel}` : ''}
        </p>
      ) : null}
    </>
  );
}

ViewerStatusBanner.propTypes = {
  errorMessage: PropTypes.string,
  levelsError: PropTypes.string,
  isFetching: PropTypes.bool.isRequired,
  panophoto: PropTypes.shape({}),
  statusMessage: PropTypes.string,
  isSavingOffset: PropTypes.bool.isRequired,
  selectedMarkerLabel: PropTypes.string,
};

ViewerStatusBanner.defaultProps = {
  errorMessage: null,
  levelsError: null,
  panophoto: null,
  statusMessage: null,
  selectedMarkerLabel: '',
};

export default ViewerStatusBanner;
