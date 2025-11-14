import React from 'react';
import PropTypes from 'prop-types';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';

function PhotoSphereCanvas({ src, plugins, onReady, onClick }) {
  return (
    <ReactPhotoSphereViewer
      src={src}
      plugins={plugins}
      height="100vh"
      width="100%"
      onReady={onReady}
      onClick={onClick}
    />
  );
}

PhotoSphereCanvas.propTypes = {
  src: PropTypes.string.isRequired,
  plugins: PropTypes.arrayOf(PropTypes.array).isRequired,
  onReady: PropTypes.func.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default PhotoSphereCanvas;
