import { useMemo } from 'react';

/**
 * useProxiedImageUrl - hook to get proxied image URLs for use in CSS backgrounds
 * or other scenarios where you need the URL string rather than an <img> element.
 * 
 * Usage examples:
 * - const bgUrl = useProxiedImageUrl({ projectId: '123', levelId: '456' });
 * - const thumbUrl = useProxiedImageUrl({ panophotoId: '789' });
 * - const fallbackUrl = useProxiedImageUrl({ src: 'https://...' });
 */
function useProxiedImageUrl({
  panophotoId,
  projectId,
  levelId,
  src,
}) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

  return useMemo(() => {
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
}

export default useProxiedImageUrl;
