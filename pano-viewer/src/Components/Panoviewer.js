import { CompassPlugin } from "@photo-sphere-viewer/compass-plugin";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import '@photo-sphere-viewer/compass-plugin/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ViewerToolbar from './Panoviewer/ViewerToolbar';
import ViewerStatusBanner from './Panoviewer/ViewerStatusBanner';
import PhotoSphereCanvas from './Panoviewer/PhotoSphereCanvas';
import useAdjustModeState from '../hooks/useAdjustModeState';
import useLinkedMarkers from '../hooks/useLinkedMarkers';
import useMarkersPlugin from '../hooks/useMarkersPlugin';
import useMarkerInteractions from '../hooks/useMarkerInteractions';
import { normalizeId } from '../utils/panophotoMath';

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
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [levelOptions, setLevelOptions] = useState([]);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [levelsError, setLevelsError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSavingOffset, setIsSavingOffset] = useState(false);

  const {
    isAdjustModeActive,
    adjustModeRef,
    selectedTargetId,
    selectedTargetIdRef,
    selectedMarkerLabel,
    enableAdjustMode,
    resetAdjustModeState: resetAdjustModeInternal,
    clearSelection,
    selectMarker,
  } = useAdjustModeState();

  const markers = useLinkedMarkers(panophoto, {
    highlightTargetId: isAdjustModeActive ? selectedTargetId : null,
    isAdjustMode: isAdjustModeActive,
  });

  const resetAdjustModeState = useCallback(() => {
    resetAdjustModeInternal();
    setStatusMessage(null);
  }, [resetAdjustModeInternal]);

  const activateAdjustMode = useCallback(() => {
    enableAdjustMode();
    setStatusMessage('Adjust mode enabled. Select a marker to reposition.');
  }, [enableAdjustMode]);

  const viewerRef = useRef(null);
  const previousPhotoIdRef = useRef(photoId);
  const isSavingOffsetRef = useRef(isSavingOffset);
  const panophotoRef = useRef(panophoto);

  useEffect(() => {
    isSavingOffsetRef.current = isSavingOffset;
  }, [isSavingOffset]);

  useEffect(() => {
    panophotoRef.current = panophoto;
  }, [panophoto]);

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

  const handleToggleAdjustMode = useCallback(() => {
    if (isSavingOffsetRef.current) {
      return;
    }

    if (adjustModeRef.current) {
      resetAdjustModeState();
      return;
    }

    activateAdjustMode();
  }, [activateAdjustMode, adjustModeRef, resetAdjustModeState]);

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

  const { handleMarkerSelect, handleViewerClick } = useMarkerInteractions({
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
  });

  useEffect(() => {
    if (previousPhotoIdRef.current !== photoId) {
      previousPhotoIdRef.current = photoId;
      resetAdjustModeState();
    }
  }, [photoId, resetAdjustModeState]);

  useEffect(() => {
    setPanophoto(null);
    setErrorMessage(null);
    setLevelOptions([]);
    setLevelsError(null);
    setIsLoadingLevels(false);
    clearSelection();
  }, [clearSelection, photoId]);

  useEffect(() => {
    if (!photoId) {
      setPanophoto(null);
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

  useMarkersPlugin({
    viewerRef,
    markers,
    handleMarkerSelect,
    isViewerReady,
  });

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
      <ViewerToolbar
        onBack={handleBackToEditor}
        onToggleAdjustMode={handleToggleAdjustMode}
        isAdjustModeActive={isAdjustModeActive}
        isSavingOffset={isSavingOffset}
        panophoto={panophoto}
        levelOptions={levelOptions}
        isLoadingLevels={isLoadingLevels}
        effectiveLevelValue={effectiveLevelValue}
        onLevelChange={handleLevelChange}
      />
      <ViewerStatusBanner
        errorMessage={errorMessage}
        levelsError={levelsError}
        isFetching={isFetching}
        panophoto={panophoto}
        statusMessage={statusMessage}
        isSavingOffset={isSavingOffset}
        selectedMarkerLabel={selectedMarkerLabel}
      />
      <PhotoSphereCanvas
        src={viewerSource}
        plugins={plugins}
        onReady={handleReady}
        onClick={handleViewerClick}
      />
    </div>
  );
}

export default Panoviewer;
