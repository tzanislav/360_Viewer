import { useMemo } from 'react';
import { extractTargetId, normalizeId } from '../utils/panophotoMath';

const useLinkLines = (visiblePhotos = [], visiblePhotoMap = new Map()) =>
  useMemo(() => {
    if (!Array.isArray(visiblePhotos) || visiblePhotos.length === 0) {
      return [];
    }

    const segments = [];
    const seenPairs = new Set();

    visiblePhotos.forEach((photo) => {
      if (!Array.isArray(photo.linkedPhotos) || photo.linkedPhotos.length === 0) {
        return;
      }

      photo.linkedPhotos.forEach((linkedRef) => {
        const linkedId = normalizeId(extractTargetId(linkedRef));

        if (!linkedId) {
          return;
        }

        const partner = visiblePhotoMap.get(linkedId);

        if (!partner) {
          return;
        }

        const key = [photo._id, partner._id].sort().join('::');

        if (seenPairs.has(key)) {
          return;
        }

        seenPairs.add(key);
        segments.push({
          id: key,
          x1: (photo.xPosition ?? 0) * 100,
          y1: (photo.yPosition ?? 0) * 100,
          x2: (partner.xPosition ?? 0) * 100,
          y2: (partner.yPosition ?? 0) * 100,
        });
      });
    });

    return segments;
  }, [visiblePhotoMap, visiblePhotos]);

export default useLinkLines;
