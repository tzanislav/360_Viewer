import { ReactPhotoSphereViewer } from "react-photo-sphere-viewer";
import { CompassPlugin } from "@photo-sphere-viewer/compass-plugin";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import '@photo-sphere-viewer/compass-plugin/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const MARKER_IMAGE = "drone.png";

const normalizeId = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value) {
    return '';
  }

  if (typeof value === 'object' && value._id) {
    if (typeof value._id.toHexString === 'function') {
      return value._id.toHexString();
    }

    if (typeof value._id.toString === 'function') {
      return value._id.toString();
    }
  }

  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return '';
};

const toFiniteOr = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const calculateAzimuthDegrees = (source, target) => {
  if (!source || !target) {
    return 0;
  }

  const sourceX = toFiniteOr(source?.xPosition, 0);
  const sourceY = toFiniteOr(source?.yPosition, 0);
  const targetX = toFiniteOr(target?.xPosition, 0);
  const targetY = toFiniteOr(target?.yPosition, 0);

  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;

  if (deltaX === 0 && deltaY === 0) {
    return 0;
  }

  const radians = Math.atan2(deltaX, -deltaY);
  const degrees = (radians * (180 / Math.PI) + 360) % 360;
  return degrees;
};

const normalizeDegrees = (value) => ((toFiniteOr(value, 0) % 360) + 360) % 360;

const normalizeOffsetDegrees = (value) => {
  const normalized = ((toFiniteOr(value, 0) + 540) % 360) - 180;
  return Number.isFinite(normalized) ? normalized : 0;
};

const radiansToDegrees = (value) => toFiniteOr(value, 0) * (180 / Math.PI);

const extractTargetId = (link) => {
  if (!link) {
    return '';
  }

  if (typeof link === 'string') {
    return link;
  }

  if (typeof link === 'object') {
    if (link.target !== undefined) {
      return extractTargetId(link.target);
    }

    if (link._id) {
      return link._id.toString();
    }
  }

  return link?.toString?.() ?? '';
};

const buildMarkersFromLinks = (panophoto, options = {}) => {
  const { highlightTargetId = null, isAdjustMode = false } = options;
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

function Panoviewer() {
  const location = useLocation();
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const statePhotoId = location.state?.panophotoId;
  const queryPhotoId = params.get('id');
  const photoId = statePhotoId || queryPhotoId || '';
  const stateSource = location.state?.src;
  const querySource = params.get('src');
  const fallbackSource = stateSource || querySource || 'testPanorama.jpg';

  const [panophoto, setPanophoto] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [levelOptions, setLevelOptions] = useState([]);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [levelsError, setLevelsError] = useState(null);
  const [isAdjustModeActive, setIsAdjustModeActive] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [selectedMarkerLabel, setSelectedMarkerLabel] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSavingOffset, setIsSavingOffset] = useState(false);

  const viewerRef = useRef(null);
  const previousPhotoIdRef = useRef(photoId);
  const adjustModeRef = useRef(isAdjustModeActive);
  const selectedTargetIdRef = useRef(selectedTargetId);
  const isSavingOffsetRef = useRef(isSavingOffset);
  const panophotoRef = useRef(panophoto);

  useEffect(() => {
    adjustModeRef.current = isAdjustModeActive;
  }, [isAdjustModeActive]);

  useEffect(() => {
    selectedTargetIdRef.current = selectedTargetId;
  }, [selectedTargetId]);

  useEffect(() => {
    isSavingOffsetRef.current = isSavingOffset;
  }, [isSavingOffset]);

  useEffect(() => {
    panophotoRef.current = panophoto;
  }, [panophoto]);

  const resetAdjustModeState = useCallback(() => {
    adjustModeRef.current = false;
    setIsAdjustModeActive(false);
    selectedTargetIdRef.current = null;
    setSelectedTargetId(null);
    setSelectedMarkerLabel('');
    setStatusMessage(null);
  }, []);

  const fetchPanophotoData = useCallback(
    async (idToLoad) => {
      const response = await fetch(`${apiBaseUrl}/api/panophotos/${idToLoad}`, {
        credentials: 'include',
      });

      const rawText = await response.text();
      let payload = null;

      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (error) {
          payload = null;
        }
      }

      if (!response.ok) {
        const message = (payload && payload.message) || rawText || 'Failed to load panophoto';
        throw new Error(message);
      }

      return payload ? payload.panophoto : null;
    },
    [apiBaseUrl]
  );

  const handleMarkerSelect = useCallback(
    (event) => {
      const markerData = getMarkerData(event?.marker);
      const targetId = markerData?.targetId;
      const currentPhotoId = normalizeId(panophotoRef.current?._id) || normalizeId(photoId);
      const adjustActive = adjustModeRef.current;

      console.log('[Panoviewer] marker selected', {
        targetId,
        adjustActive,
        photoId,
      });

      if (!targetId || (currentPhotoId && targetId === currentPhotoId)) {
        return;
      }

      if (adjustActive) {
        setSelectedTargetId(targetId);
        selectedTargetIdRef.current = targetId;
        setSelectedMarkerLabel(markerData?.label || 'Linked photo');
        setStatusMessage('Marker selected. Click anywhere in the scene to place it.');
        return;
      }

      resetAdjustModeState();
      navigate(`/viewer?id=${targetId}`, {
        state: { panophotoId: targetId },
        replace: false,
      });
    },
    [navigate, photoId, resetAdjustModeState]
  );

  const handleToggleAdjustMode = useCallback(() => {
    if (isSavingOffsetRef.current) {
      return;
    }

    if (adjustModeRef.current) {
      resetAdjustModeState();
      return;
    }

    adjustModeRef.current = true;
    setIsAdjustModeActive(true);
    selectedTargetIdRef.current = null;
    setSelectedTargetId(null);
    setSelectedMarkerLabel('');
    setStatusMessage('Adjust mode enabled. Select a marker to reposition.');
  }, [resetAdjustModeState]);

  const handleBackToEditor = useCallback(() => {
    resetAdjustModeState();
    navigate('/projects/editor');
  }, [navigate, resetAdjustModeState]);

  const saveMarkerOffset = useCallback(
    async (targetId, offsetValue) => {
      if (!photoId) {
        throw new Error('No active panophoto selected');
      }

      const response = await fetch(`${apiBaseUrl}/api/panophotos/${photoId}/links/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ azimuthOffset: offsetValue }),
      });

      const rawText = await response.text();
      let payload = null;

      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (error) {
          payload = null;
        }
      }

      if (!response.ok) {
        const message = (payload && payload.message) || rawText || 'Failed to update marker offset';
        throw new Error(message);
      }

      return payload ? payload.panophoto : null;
    },
    [apiBaseUrl, photoId]
  );

  const handleViewerClick = useCallback(async (eventData) => {
    const adjustActive = adjustModeRef.current;
    const activeTargetId = selectedTargetIdRef.current;
    const savingOffset = isSavingOffsetRef.current;
    const currentPanophoto = panophotoRef.current;
    const currentPhotoId = normalizeId(currentPanophoto?._id) || normalizeId(photoId);

    console.log('[Panoviewer] viewer click received', {
      eventData,
      adjustActive,
      activeTargetId,
      savingOffset,
    });

    if (!adjustActive || !activeTargetId || savingOffset) {
      return;
    }

    if (!currentPanophoto) {
      console.warn('[Panoviewer] click ignored because panophoto data is missing');
      return;
    }

    if (currentPhotoId && activeTargetId === currentPhotoId) {
      console.warn('[Panoviewer] ignoring adjust attempt for self link', {
        activeTargetId,
        currentPhotoId,
      });
      setStatusMessage('Cannot adjust a link pointing to this photo. Select another marker.');
      setSelectedTargetId(null);
      selectedTargetIdRef.current = null;
      setSelectedMarkerLabel('');
      return;
    }

    const candidateSources = [
      eventData && typeof eventData === 'object' ? eventData.data : null,
      eventData && typeof eventData === 'object' ? eventData.event?.data : null,
      eventData && typeof eventData === 'object' ? eventData.event : null,
      eventData,
    ].filter(Boolean);

    const payload = candidateSources.find((candidate) => typeof candidate === 'object') || {};

    console.log('[Panoviewer] click payload candidates', {
      candidateSources,
      chosenPayload: payload,
    });

    const markerIdFromEvent =
      (payload && typeof payload === 'object' && payload.markerId) ||
      (payload && payload.marker && payload.marker.config && payload.marker.config.id) ||
      null;

    if (markerIdFromEvent) {
      console.log('[Panoviewer] click originated from marker, ignoring', { markerIdFromEvent });
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

    console.log('[Panoviewer] yaw candidates', {
      yawCandidates,
      yawCandidate,
    });

    if (!yawCandidate) {
      setStatusMessage('Unable to determine where you clicked. Try again.');
      console.log('[Panoviewer] no usable yaw from click payload');
      return;
    }

    const yawDegrees = normalizeDegrees(
      yawCandidate.unit === 'degrees'
        ? yawCandidate.value
        : radiansToDegrees(yawCandidate.value)
    );

    console.log('[Panoviewer] computed yaw', {
      yawCandidate,
      yawDegrees,
    });

    const link = (currentPanophoto?.linkedPhotos || []).find(
      (currentLink) => extractTargetId(currentLink) === activeTargetId,
    );

    if (!link) {
      setStatusMessage('Selected marker could not be found. Please select it again.');
      setSelectedTargetId(null);
      selectedTargetIdRef.current = null;
      setSelectedMarkerLabel('');
      console.warn('[Panoviewer] selected link missing in panophoto data', {
        selectedTargetId: activeTargetId,
        links: currentPanophoto?.linkedPhotos,
      });
      return;
    }

    const baseAzimuth = normalizeDegrees(toFiniteOr(link?.azimuth, calculateAzimuthDegrees(currentPanophoto, link?.target)));
    const currentOffset = normalizeOffsetDegrees(link?.azimuthOffset);
    const newOffset = normalizeOffsetDegrees(yawDegrees - baseAzimuth);
    const offsetDelta = Math.abs(((newOffset - currentOffset + 540) % 360) - 180);

    console.log('[Panoviewer] offset computation', {
      baseAzimuth,
      currentOffset,
      newOffset,
      offsetDelta,
    });

    if (offsetDelta < 0.1) {
      setStatusMessage('Marker offset unchanged. Click another direction or select a different marker.');
      console.log('[Panoviewer] offset change below threshold');
      return;
    }

    try {
      setIsSavingOffset(true);
      isSavingOffsetRef.current = true;
      setStatusMessage('Saving marker offset…');

      console.log('[Panoviewer] saving marker offset', {
        photoId,
        selectedTargetId: activeTargetId,
        newOffset,
      });

      const updatedPanophoto = await saveMarkerOffset(activeTargetId, newOffset);

      if (updatedPanophoto) {
        console.log('[Panoviewer] offset save returned updated panophoto');
        setPanophoto(updatedPanophoto);
      } else {
        const refreshed = await fetchPanophotoData(photoId);
        console.log('[Panoviewer] offset save returned null, fetched latest panophoto');
        setPanophoto(refreshed);
      }

      setStatusMessage('Marker offset updated. Select another marker to continue.');
    } catch (error) {
      console.error('Failed to update marker offset:', error);
      setStatusMessage(error.message);

      console.log('[Panoviewer] offset save failed, attempting refresh');

      try {
        const refreshed = await fetchPanophotoData(photoId);
        setPanophoto(refreshed);
      } catch (refreshError) {
        console.error('Failed to refresh panophoto after offset error:', refreshError);
      }
    } finally {
      setIsSavingOffset(false);
      isSavingOffsetRef.current = false;
      setSelectedTargetId(null);
      selectedTargetIdRef.current = null;
      setSelectedMarkerLabel('');
    }
  }, [fetchPanophotoData, panophoto, photoId, saveMarkerOffset]);

  useEffect(() => {
    if (previousPhotoIdRef.current !== photoId) {
      previousPhotoIdRef.current = photoId;
      resetAdjustModeState();
    }
  }, [photoId, resetAdjustModeState]);

  useEffect(() => {
    setPanophoto(null);
    setMarkers([]);
    setErrorMessage(null);
    setLevelOptions([]);
    setLevelsError(null);
    setIsLoadingLevels(false);
    setSelectedTargetId(null);
    selectedTargetIdRef.current = null;
    setSelectedMarkerLabel('');
  }, [photoId]);

  useEffect(() => {
    if (!photoId) {
      setPanophoto(null);
      setMarkers([]);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setIsFetching(true);
      setErrorMessage(null);

      try {
        const panophotoData = await fetchPanophotoData(photoId);

        if (isCancelled) {
          return;
        }

        setPanophoto(panophotoData);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to fetch panophoto:', error);
          setErrorMessage(error.message);
          setPanophoto(null);
          setMarkers([]);
        }
      } finally {
        if (!isCancelled) {
          setIsFetching(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [fetchPanophotoData, photoId]);

  useEffect(() => {
    if (!panophoto) {
      setMarkers([]);
      return;
    }

    setMarkers(
      buildMarkersFromLinks(panophoto, {
        highlightTargetId: isAdjustModeActive ? selectedTargetId : null,
        isAdjustMode: isAdjustModeActive,
      })
    );
  }, [isAdjustModeActive, panophoto, selectedTargetId]);

  useEffect(() => {
    if (!panophoto?.project?._id || !Array.isArray(panophoto.project.levels)) {
      setLevelOptions([]);
      setLevelsError(null);
      setIsLoadingLevels(false);
      return;
    }

    let isCancelled = false;

    const loadLevelOptions = async () => {
      setIsLoadingLevels(true);
      setLevelsError(null);

      try {
        const query = new URLSearchParams({ projectId: panophoto.project._id }).toString();
        const response = await fetch(`${apiBaseUrl}/api/panophotos?${query}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to load project photos');
        }

        const payload = await response.json();

        if (isCancelled) {
          return;
        }

        const photos = Array.isArray(payload.panophotos) ? payload.panophotos : [];

        const getFirstPhotoId = (levelId) => {
          if (!levelId) {
            return null;
          }

          const matches = photos.filter((photo) => normalizeId(photo.levelId) === levelId);

          if (matches.length === 0) {
            return null;
          }

          matches.sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return aTime - bTime;
          });

          const first = matches[0];
          return first?._id ? normalizeId(first._id) : null;
        };

        const options = panophoto.project.levels.map((level) => {
          const levelId = normalizeId(level?._id);
          const storedStartId = normalizeId(level?.startPanophoto) || null;

          const storedStartPhoto = storedStartId
            ? photos.find((photo) => normalizeId(photo?._id) === storedStartId)
            : null;

          const storedMatchesLevel = storedStartPhoto
            ? normalizeId(storedStartPhoto.levelId) === levelId
            : false;

          const fallbackPhotoId = getFirstPhotoId(levelId);
          const chosenStartId = storedMatchesLevel
            ? normalizeId(storedStartPhoto?._id)
            : fallbackPhotoId;

          return {
            id: levelId,
            name: level?.name || 'Level',
            firstPhotoId: chosenStartId,
            startPhotoId: storedMatchesLevel ? normalizeId(storedStartPhoto?._id) : null,
            fallbackPhotoId,
          };
        });

        setLevelOptions(options);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load level options:', error);
          setLevelOptions([]);
          setLevelsError(error.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingLevels(false);
        }
      }
    };

    loadLevelOptions();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl, panophoto]);

  useEffect(() => {
    if (!isViewerReady) {
      return;
    }

    const instance = viewerRef.current;

    if (!instance) {
      return;
    }

    const markersPlugin = instance.getPlugin(MarkersPlugin);

    if (!markersPlugin) {
      return;
    }

    const listener = (event) => handleMarkerSelect(event);
    markersPlugin.addEventListener('select-marker', listener);

    return () => {
      markersPlugin.removeEventListener('select-marker', listener);
    };
  }, [handleMarkerSelect, isViewerReady]);

  useEffect(() => {
    if (!isViewerReady) {
      return;
    }

    const instance = viewerRef.current;

    if (!instance) {
      return;
    }

    const markersPlugin = instance.getPlugin(MarkersPlugin);

    if (!markersPlugin) {
      return;
    }

    if (typeof markersPlugin.setMarkers === 'function') {
      markersPlugin.setMarkers(markers);
      return;
    }

    if (typeof markersPlugin.clearMarkers === 'function') {
      markersPlugin.clearMarkers();
    }

    if (Array.isArray(markers)) {
      markers.forEach((marker) => {
        try {
          markersPlugin.addMarker(marker);
        } catch (error) {
          console.error('Failed to add marker:', error);
        }
      });
    }
  }, [isViewerReady, markers]);

  const handleReady = useCallback((instance) => {
    viewerRef.current = instance;
    setIsViewerReady(true);
  }, []);

  const selectedLevelId = useMemo(() => normalizeId(panophoto?.levelId), [panophoto]);

  const effectiveLevelValue = useMemo(() => {
    if (!selectedLevelId) {
      return 'unplaced';
    }

    const hasMatch = levelOptions.some((option) => option.id === selectedLevelId);
    return hasMatch ? selectedLevelId : 'unplaced';
  }, [levelOptions, selectedLevelId]);

  const handleLevelChange = useCallback(
    (event) => {
      const levelId = event.target.value;

      if (!levelId || levelId === 'unplaced') {
        return;
      }

      const match = levelOptions.find((option) => option.id === levelId);

      if (!match || !match.firstPhotoId) {
        return;
      }

      if (match.firstPhotoId === photoId) {
        return;
      }

      resetAdjustModeState();
      navigate(`/viewer?id=${match.firstPhotoId}`, {
        state: { panophotoId: match.firstPhotoId },
        replace: false,
      });
    },
    [levelOptions, navigate, photoId, resetAdjustModeState]
  );

  const plugins = useMemo(
    () => [
      [CompassPlugin, {}],
      [MarkersPlugin, { markers: [] }],
    ],
    []
  );

  const viewerSource = useMemo(() => {
    if (photoId && panophoto) {
      return `${apiBaseUrl}/api/panophotos/${photoId}/image`;
    }
    return panophoto?.imageUrl || fallbackSource;
  }, [apiBaseUrl, photoId, panophoto, fallbackSource]);

  if (errorMessage && !photoId) {
    return (
      <div className="App">
        <p className="panophoto-status error">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="viewer-toolbar">
        <button
          type="button"
          className="viewer-editor-button"
          onClick={handleBackToEditor}
        >
          Back to Editor
        </button>
        <button
          type="button"
          className={`viewer-editor-button adjust-toggle${isAdjustModeActive ? ' active' : ''}`}
          onClick={handleToggleAdjustMode}
          disabled={!panophoto?.linkedPhotos?.length || isSavingOffset}
        >
          {isAdjustModeActive ? 'Done Adjusting Markers' : 'Adjust Marker Positions'}
        </button>
        <div className="viewer-level-selector">
          <label>
            <span>Level</span>
            <select
              value={effectiveLevelValue}
              onChange={handleLevelChange}
              disabled={isLoadingLevels || levelOptions.length === 0}
            >
              <option value="unplaced">
                {isLoadingLevels ? 'Loading…' : 'Select level'}
              </option>
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
      {errorMessage ? <p className="panophoto-status error">{errorMessage}</p> : null}
      {levelsError ? <p className="panophoto-status error">{levelsError}</p> : null}
      {isFetching && !panophoto ? <p className="panophoto-status">Loading…</p> : null}
      {statusMessage ? (
        <p className={`panophoto-status${isSavingOffset ? ' pending' : ''}`}>
          {statusMessage}
          {selectedMarkerLabel ? ` — ${selectedMarkerLabel}` : ''}
        </p>
      ) : null}
      <ReactPhotoSphereViewer
        src={viewerSource}
        plugins={plugins}
        height={"100vh"}
        width={"100%"}
        onReady={handleReady}
        onClick={handleViewerClick}
      ></ReactPhotoSphereViewer>
    </div>
  );
}

export default Panoviewer;
