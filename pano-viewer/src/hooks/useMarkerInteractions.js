import { useCallback } from 'react';
import {
  calculateAzimuthDegrees,
  extractTargetId,
  normalizeDegrees,
  normalizeId,
  normalizeOffsetDegrees,
  radiansToDegrees,
  toFiniteOr,
} from '../utils/panophotoMath';

const getMarkerData = (marker) => {
  if (!marker) {
    return {};
  }

  if (marker.config && marker.config.data) {
    return marker.config.data;
  }

  if (marker.data) {
    return marker.data;
  }

  return {};
};

const useMarkerInteractions = ({
  adjustModeRef,
  clearSelection,
  fetchPanophotoData,
  isSavingOffsetRef,
  navigate,
  panophotoRef,
  photoId,
  resetAdjustModeState,
  saveMarkerOffset,
  selectMarker,
  selectedTargetIdRef,
  setIsSavingOffset,
  setPanophoto,
  setStatusMessage,
}) => {
  const handleMarkerSelect = useCallback(
    (event) => {
      const markerData = getMarkerData(event?.marker);
      const targetId = markerData?.targetId;
      const currentPhotoId = normalizeId(panophotoRef.current?._id) || normalizeId(photoId);
      const adjustActive = adjustModeRef.current;

      if (!targetId || (currentPhotoId && targetId === currentPhotoId)) {
        return;
      }

      if (adjustActive) {
        selectMarker(targetId, markerData?.label || 'Linked photo');
        setStatusMessage('Marker selected. Click anywhere in the scene to place it.');
        return;
      }

      resetAdjustModeState();
      navigate(`/viewer?id=${targetId}`, {
        state: { panophotoId: targetId },
        replace: false,
      });
    },
    [adjustModeRef, navigate, panophotoRef, photoId, resetAdjustModeState, selectMarker, setStatusMessage]
  );

  const handleViewerClick = useCallback(
    async (eventData) => {
      const adjustActive = adjustModeRef.current;
      const activeTargetId = selectedTargetIdRef.current;
      const savingOffset = isSavingOffsetRef.current;
      const currentPanophoto = panophotoRef.current;
      const currentPhotoId = normalizeId(currentPanophoto?._id) || normalizeId(photoId);

      if (!adjustActive || !activeTargetId || savingOffset) {
        return;
      }

      if (!currentPanophoto) {
        return;
      }

      if (currentPhotoId && activeTargetId === currentPhotoId) {
        setStatusMessage('Cannot adjust a link pointing to this photo. Select another marker.');
        clearSelection();
        return;
      }

      const candidateSources = [
        eventData && typeof eventData === 'object' ? eventData.data : null,
        eventData && typeof eventData === 'object' ? eventData.event?.data : null,
        eventData && typeof eventData === 'object' ? eventData.event : null,
        eventData,
      ].filter(Boolean);

      const payload = candidateSources.find((candidate) => typeof candidate === 'object') || {};

      const markerIdFromEvent =
        (payload && typeof payload === 'object' && payload.markerId) ||
        (payload && payload.marker && payload.marker.config && payload.marker.config.id) ||
        null;

      if (markerIdFromEvent) {
        return;
      }

      const extractAngle = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }

        if (typeof value === 'string') {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }

        return null;
      };

      const toAngleCandidate = (value, unit = 'radians') => {
        const parsed = extractAngle(value);
        if (!Number.isFinite(parsed)) {
          return null;
        }

        return { value: parsed, unit };
      };

      const yawCandidates = [
        toAngleCandidate(payload?.longitude, 'radians'),
        toAngleCandidate(payload?.yaw, 'radians'),
        toAngleCandidate(payload?.position?.longitude, 'radians'),
        toAngleCandidate(payload?.position?.yaw, 'radians'),
        toAngleCandidate(payload?.angles?.longitude, 'radians'),
        toAngleCandidate(payload?.angles?.yaw, 'radians'),
        toAngleCandidate(payload?.data?.longitude, 'radians'),
        toAngleCandidate(payload?.data?.yaw, 'radians'),
        toAngleCandidate(payload?.longitudeDeg, 'degrees'),
        toAngleCandidate(payload?.yawDeg, 'degrees'),
        toAngleCandidate(payload?.data?.yawDegrees, 'degrees'),
      ].filter(Boolean);

      const yawCandidate = yawCandidates.length > 0 ? yawCandidates[0] : null;

      if (!yawCandidate) {
        setStatusMessage('Unable to determine where you clicked. Try again.');
        return;
      }

      const yawDegrees = normalizeDegrees(
        yawCandidate.unit === 'degrees'
          ? yawCandidate.value
          : radiansToDegrees(yawCandidate.value)
      );

      const link = (currentPanophoto?.linkedPhotos || []).find(
        (currentLink) => extractTargetId(currentLink) === activeTargetId,
      );

      if (!link) {
        setStatusMessage('Selected marker could not be found. Please select it again.');
        clearSelection();
        return;
      }

      const baseAzimuth = normalizeDegrees(
        toFiniteOr(link?.azimuth, calculateAzimuthDegrees(currentPanophoto, link?.target))
      );
      const currentOffset = normalizeOffsetDegrees(link?.azimuthOffset);
      const newOffset = normalizeOffsetDegrees(yawDegrees - baseAzimuth);
      const offsetDelta = Math.abs(((newOffset - currentOffset + 540) % 360) - 180);

      if (offsetDelta < 0.1) {
        setStatusMessage('Marker offset unchanged. Click another direction or select a different marker.');
        return;
      }

      try {
        setIsSavingOffset(true);
        isSavingOffsetRef.current = true;
        setStatusMessage('Saving marker offset…');

        const updatedPanophoto = await saveMarkerOffset(activeTargetId, newOffset);

        if (updatedPanophoto) {
          setPanophoto(updatedPanophoto);
        } else {
          const refreshed = await fetchPanophotoData(photoId);
          setPanophoto(refreshed);
        }

        setStatusMessage('Marker offset updated. Select another marker to continue.');
      } catch (error) {
        setStatusMessage(error.message);

        try {
          const refreshed = await fetchPanophotoData(photoId);
          setPanophoto(refreshed);
        } catch (refreshError) {
          console.error('Failed to refresh panophoto after offset error:', refreshError);
        }
      } finally {
        setIsSavingOffset(false);
        isSavingOffsetRef.current = false;
        clearSelection();
      }
    },
    [
      adjustModeRef,
      clearSelection,
      fetchPanophotoData,
      isSavingOffsetRef,
      panophotoRef,
      photoId,
      saveMarkerOffset,
      selectedTargetIdRef,
      setIsSavingOffset,
      setPanophoto,
      setStatusMessage,
    ]
  );

  return { handleMarkerSelect, handleViewerClick };
};

export default useMarkerInteractions;
