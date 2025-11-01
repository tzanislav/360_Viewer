import { ReactPhotoSphereViewer } from "react-photo-sphere-viewer";
import { CompassPlugin } from "@photo-sphere-viewer/compass-plugin";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import '@photo-sphere-viewer/compass-plugin/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const MARKER_IMAGE = "drone.png";

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

  const plugins = useMemo(
    () => [
      [CompassPlugin, {}],
      [MarkersPlugin, { markers: [] }],
    ],
    []
  );

  const viewerSource = panophoto?.imageUrl || fallbackSource;

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
      </div>
      {errorMessage ? <p className="panophoto-status error">{errorMessage}</p> : null}
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