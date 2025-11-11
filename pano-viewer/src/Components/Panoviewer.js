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

const buildMarkersFromLinks = (panophoto) => {
  if (!panophoto?.linkedPhotos?.length) {
    return [];
  }

  return panophoto.linkedPhotos
    .map((link, index) => {
      const targetId = extractTargetId(link);

      if (!targetId) {
        return null;
      }

      const azimuth = Number.isFinite(Number(link?.azimuth))
        ? Number(link.azimuth)
        : calculateAzimuthDegrees(panophoto, link?.target);
      const azimuthOffset = toFiniteOr(link?.azimuthOffset, 0);
      const yaw = ((azimuth + azimuthOffset) % 360 + 360) % 360;
      const label = link?.target?.name || 'View linked photo';

      return {
        id: `link-${targetId}-${index}`,
        image: MARKER_IMAGE,
        size: { width: 64, height: 64 },
        position: { yaw: `${yaw}deg`, pitch: '-0.1deg' },
        tooltip: label,
        data: { targetId },
      };
    })
    .filter(Boolean);
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

  const viewerRef = useRef(null);

  const handleMarkerSelect = useCallback(
    (event) => {
      const targetId = event?.marker?.data?.targetId;

      if (!targetId || targetId === photoId) {
        return;
      }

      navigate(`/viewer?id=${targetId}`, {
        state: { panophotoId: targetId },
        replace: false,
      });
    },
    [navigate, photoId]
  );

  useEffect(() => {
    setPanophoto(null);
    setMarkers([]);
    setErrorMessage(null);
    setLevelOptions([]);
    setLevelsError(null);
    setIsLoadingLevels(false);
  }, [photoId]);

  useEffect(() => {
    if (!photoId) {
      return;
    }

    let isCancelled = false;

    const fetchPanophoto = async () => {
      setIsFetching(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/panophotos/${photoId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to load panophoto');
        }

        const payload = await response.json();

        if (isCancelled) {
          return;
        }

        setPanophoto(payload.panophoto);
        setMarkers(buildMarkersFromLinks(payload.panophoto));
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

    fetchPanophoto();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl, photoId]);

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
          return {
            id: levelId,
            name: level?.name || 'Level',
            firstPhotoId: getFirstPhotoId(levelId),
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

      navigate(`/viewer?id=${match.firstPhotoId}`, {
        state: { panophotoId: match.firstPhotoId },
        replace: false,
      });
    },
    [levelOptions, navigate, photoId]
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
      // Use backend proxy to avoid CORS issues with S3
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
          onClick={() => navigate('/projects/editor')}
        >
          Back to Editor
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
      <ReactPhotoSphereViewer
        src={viewerSource}
        plugins={plugins}
        height={"100vh"}
        width={"100%"}
        onReady={handleReady}
      ></ReactPhotoSphereViewer>
    </div>
  );
}

export default Panoviewer;