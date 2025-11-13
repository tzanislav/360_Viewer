import React, { useMemo } from 'react';

/**
 * ProxiedImage component - unified image loading that uses backend proxy endpoints
 * to avoid CORS/CORB issues when loading from S3.
 * 
 * Usage examples:
 * - Panophoto: <ProxiedImage panophotoId="123" alt="Photo" />
 * - Background: <ProxiedImage projectId="456" levelId="789" alt="Background" />
 * - Direct URL fallback: <ProxiedImage src="https://..." alt="Image" />
 */
function ProxiedImage({
  panophotoId,
  projectId,
  levelId,
  src,
  alt = '',
  className = '',
  style = {},
  loading = 'lazy',
  onLoad,
  onError,
}) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

  const imageSource = useMemo(() => {
    // Panophoto image proxy
    if (panophotoId) {
      return `${apiBaseUrl}/api/panophotos/${panophotoId}/image`;
    }

    // Project background image proxy
    if (projectId) {
      const levelParam = levelId ? `?levelId=${levelId}` : '';
      return `${apiBaseUrl}/api/projects/${projectId}/background/image${levelParam}`;
    }

    // Direct URL fallback
    return src || '';
  }, [apiBaseUrl, panophotoId, projectId, levelId, src]);

  if (!imageSource) {
    return null;
  }

  return (
    <img
      src={imageSource}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

export default ProxiedImage;
