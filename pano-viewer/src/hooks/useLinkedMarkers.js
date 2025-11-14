import { useMemo } from 'react';
import {
  calculateAzimuthDegrees,
  extractTargetId,
  normalizeId,
  toFiniteOr,
} from '../utils/panophotoMath';

const MARKER_IMAGE = 'drone.png';

const buildMarkersFromLinks = (panophoto, options) => {
  const {
    highlightTargetId = null,
    isAdjustMode = false,
  } = options;
  const currentPhotoId = normalizeId(panophoto?._id);

  if (!panophoto?.linkedPhotos?.length) {
    return [];
  }

  return panophoto.linkedPhotos
    .map((link, index) => {
      const targetId = extractTargetId(link);

      if (!targetId) {
        return null;
      }

      if (currentPhotoId && targetId === currentPhotoId) {
        return null;
      }

      const azimuth = Number.isFinite(Number(link?.azimuth))
        ? Number(link.azimuth)
        : calculateAzimuthDegrees(panophoto, link?.target);
      const azimuthOffset = toFiniteOr(link?.azimuthOffset, 0);
      const yaw = ((azimuth + azimuthOffset) % 360 + 360) % 360;
      const label = link?.target?.name || 'View linked photo';
      const isHighlighted = Boolean(highlightTargetId && highlightTargetId === targetId);

      const marker = {
        id: `link-${targetId}-${index}`,
        image: MARKER_IMAGE,
        size: { width: 64, height: 64 },
        position: { yaw: `${yaw}deg`, pitch: '-0.1deg' },
        tooltip: label,
        data: { targetId, azimuth, azimuthOffset, label },
      };

      if (isAdjustMode) {
        marker.style = {
          cursor: 'pointer',
          opacity: isHighlighted ? 1 : 0.65,
          filter: isHighlighted ? 'drop-shadow(0 0 12px #10b981)' : undefined,
        };
      }

      return marker;
    })
    .filter(Boolean);
};

const useLinkedMarkers = (
  panophoto,
  { highlightTargetId = null, isAdjustMode = false } = {}
) =>
  useMemo(() => {
    if (!panophoto) {
      return [];
    }

    return buildMarkersFromLinks(panophoto, { highlightTargetId, isAdjustMode });
  }, [highlightTargetId, isAdjustMode, panophoto]);

export default useLinkedMarkers;
export { buildMarkersFromLinks };
