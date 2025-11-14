import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProjectPhotoBrowser from '../Components/ProjectEditor/ProjectPhotoBrowser';
import ProjectPhotoUploadForm from '../Components/ProjectEditor/ProjectPhotoUploadForm';
import ProjectBackgroundPanel from '../Components/ProjectEditor/ProjectBackgroundPanel';
import ProjectCanvasPanel from '../Components/ProjectEditor/ProjectCanvasPanel';
import '../CSS/styles.css';
import { normalizeId } from '../utils/panophotoMath';
import useLinkLines from '../hooks/useLinkLines';
import useProjectLevelDerivedState from '../hooks/useProjectLevelDerivedState';
import useCanvasBackgroundState from '../hooks/useCanvasBackgroundState';

// clamp01 forces numeric input into the [0, 1] range for canvas coordinates.
const clamp01 = (value) => {
  const parsed = Number.parseFloat(value);

  if (Number.isFinite(parsed)) {
    return Math.min(1, Math.max(0, parsed));
  }

  return 0;
};

const DEFAULT_CANVAS_ASPECT_RATIO = 0.75;

// ProjectEditor coordinates managing pano photos, canvas layout, and linking UI.
function ProjectEditor() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
  const navigate = useNavigate();
  const [activeProject, setActiveProject] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [linkSourceId, setLinkSourceId] = useState(null);
  const [isLinkPending, setIsLinkPending] = useState(false);
  const [deletingPhotoIds, setDeletingPhotoIds] = useState([]);
  const [startPhotoId, setStartPhotoId] = useState(null);
  const canvasRef = useRef(null);
  const [draggingPhotoId, setDraggingPhotoId] = useState(null);
  const dragStateRef = useRef({
    photoId: null,
    pointerId: null,
    startPosition: null,
    position: null,
    hasMoved: false,
    levelId: null,
  });
  const suppressClickRef = useRef(false);
  const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
  const [showCanvasLabels, setShowCanvasLabels] = useState(true);
  const [canvasAspectRatio, setCanvasAspectRatio] = useState(DEFAULT_CANVAS_ASPECT_RATIO);
  const [activeLevelId, setActiveLevelId] = useState(null);
  const [isLevelRequestPending, setIsLevelRequestPending] = useState(false);
  const [isLevelStartPending, setIsLevelStartPending] = useState(false);

  const {
    selectedPhoto,
    levels,
    activeLevel,
    resolvedActiveLevelId,
    isSelectedOnActiveLevel,
    visiblePhotos,
    visiblePhotoMap,
    levelStartPhotoIdMap,
    levelNameById,
    resolvedActiveLevelStartPhotoId,
    storedActiveLevelStartPhotoId,
    isSelectedStoredLevelStart,
    resolvedStartPhotoId,
    resolvedStartPhoto,
    isSelectedStoredStart,
    levelStartSummary,
  } = useProjectLevelDerivedState({
    activeProject,
    photos,
    selectedPhotoId,
    startPhotoId,
    activeLevelId,
  });

  useEffect(() => {
    if (!levels.length) {
      setActiveLevelId(null);
      return;
    }

    const normalizedIds = levels
      .map((level) => normalizeId(level?._id))
      .filter((value) => Boolean(value));

    if (normalizedIds.length === 0) {
      setActiveLevelId(null);
      return;
    }

    setActiveLevelId((prev) => {
      if (prev && normalizedIds.includes(prev)) {
        return prev;
      }
      return normalizedIds[0];
    });
  }, [levels, setActiveLevelId]);

  const linkingSourcePhoto = useMemo(
    () => photos.find((photo) => photo._id === linkSourceId),
    [photos, linkSourceId]
  );
  const linkLines = useLinkLines(visiblePhotos, visiblePhotoMap);

  const {
    resolvedBackgroundUrl,
    hasBackgroundImage,
    shouldShowBackground,
    resolvedCanvasAspectRatio,
    canvasPaddingStyle,
  } = useCanvasBackgroundState({
    activeProject,
    activeLevel,
    isBackgroundVisible,
    canvasAspectRatio,
    defaultCanvasAspectRatio: DEFAULT_CANVAS_ASPECT_RATIO,
  });

  // loadActiveProject fetches currently active project metadata from the API.
  const loadActiveProject = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/projects/active`, { credentials: 'include' });

      if (!response.ok) {
        setActiveProject(null);
        setStartPhotoId(null);
        return;
      }

      const payload = await response.json();
      setActiveProject(payload.project);
      setStartPhotoId(normalizeId(payload.project?.startPanophoto) || null);
    } catch (error) {
      console.error('Failed to fetch active project:', error);
      setActiveProject(null);
      setStartPhotoId(null);
    }
  }, [apiBaseUrl]);

  // loadPhotos pulls all pano photos for the active project.
  const loadPhotos = useCallback(
    async (projectId) => {
      if (!projectId) {
        setPhotos([]);
        return;
      }

      try {
        const query = new URLSearchParams({ projectId }).toString();
        const response = await fetch(`${apiBaseUrl}/api/panophotos?${query}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load project panophotos');
        }

        const payload = await response.json();
        setPhotos(payload.panophotos || []);
      } catch (error) {
        console.error('Failed to load project panophotos:', error);
        setPhotos([]);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    loadActiveProject();
  }, [loadActiveProject]);

  useEffect(() => {
    const normalizedStartId = normalizeId(activeProject?.startPanophoto);
    setStartPhotoId(normalizedStartId || null);
  }, [activeProject]);

  useEffect(() => {
    setIsBackgroundVisible(Boolean(resolvedBackgroundUrl));
  }, [resolvedBackgroundUrl]);

  useEffect(() => {
    const backgroundUrl = resolvedBackgroundUrl;

    if (!backgroundUrl) {
      setCanvasAspectRatio(DEFAULT_CANVAS_ASPECT_RATIO);
      return;
    }

    let isMounted = true;
    const image = new Image();

    image.onload = () => {
      if (!isMounted) {
        return;
      }

      const width = Number.isFinite(image.naturalWidth) ? image.naturalWidth : 0;
      const height = Number.isFinite(image.naturalHeight) ? image.naturalHeight : 0;
      const ratio = width > 0 ? height / width : DEFAULT_CANVAS_ASPECT_RATIO;

      if (Number.isFinite(ratio) && ratio > 0) {
        setCanvasAspectRatio(ratio);
      } else {
        setCanvasAspectRatio(DEFAULT_CANVAS_ASPECT_RATIO);
      }
    };

    image.onerror = () => {
      if (isMounted) {
        setCanvasAspectRatio(DEFAULT_CANVAS_ASPECT_RATIO);
      }
    };

    image.src = backgroundUrl;

    return () => {
      isMounted = false;
    };
  }, [resolvedBackgroundUrl]);

  useEffect(() => {
    if (activeProject?._id) {
      loadPhotos(activeProject._id);
    } else {
      setPhotos([]);
    }
    setSelectedPhotoId(null);
    setLinkSourceId(null);
    setDeletingPhotoIds([]);
  }, [activeProject, loadPhotos]);

  useEffect(() => {
    if (!selectedPhotoId) {
      setLinkSourceId(null);
    }
  }, [selectedPhotoId]);

  useEffect(() => {
    setLinkSourceId(null);
  }, [resolvedActiveLevelId]);

  // mergeUpdatedPhotos applies partial API updates to the local photo list.
  const mergeUpdatedPhotos = useCallback((updatedList) => {
    if (!Array.isArray(updatedList) || updatedList.length === 0) {
      return;
    }

    setPhotos((prev) => {
      const updateMap = new Map(updatedList.map((photo) => [photo._id, photo]));
      return prev.map((photo) => (updateMap.has(photo._id) ? { ...photo, ...updateMap.get(photo._id) } : photo));
    });
  }, [setPhotos]);

  const prependUploadedPhotos = useCallback((newPhotos) => {
    if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
      return;
    }

    setPhotos((prev) => [...newPhotos, ...prev]);
  }, [setPhotos]);

  // handleToggleCanvasLabels shows or hides marker name labels on the canvas.
  const handleToggleCanvasLabels = useCallback((event) => {
    setShowCanvasLabels(event.target.checked);
  }, [setShowCanvasLabels]);

  // persistPhotoPosition saves marker drag results and syncs neighbor azimuths.
  const persistPhotoPosition = useCallback(
    async (photoId, xPosition, yPosition, fallbackState, options = {}) => {
      if (!photoId) {
        return;
      }

      const updatePayload = { xPosition, yPosition };

      if (Object.prototype.hasOwnProperty.call(options, 'levelId')) {
        updatePayload.levelId = options.levelId;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/panophotos/${photoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to update photo position');
        }

        const payload = await response.json();

        const updates = [];

        if (payload.panophoto) {
          updates.push(payload.panophoto);
        }

        if (Array.isArray(payload.neighbors)) {
          payload.neighbors.filter(Boolean).forEach((neighbor) => {
            updates.push(neighbor);
          });
        }

        mergeUpdatedPhotos(updates);
        setStatusMessage({
          type: 'success',
          message: options.successMessage || 'Photo position updated.',
        });
      } catch (error) {
        setStatusMessage({ type: 'error', message: error.message });

        if (fallbackState) {
          setPhotos((prev) =>
            prev.map((photo) => {
              if (photo._id !== photoId) {
                return photo;
              }

              const next = { ...photo };

              if (Number.isFinite(fallbackState.x)) {
                next.xPosition = fallbackState.x;
              }

              if (Number.isFinite(fallbackState.y)) {
                next.yPosition = fallbackState.y;
              }

              if (Object.prototype.hasOwnProperty.call(fallbackState, 'levelId')) {
                next.levelId = fallbackState.levelId;
              }

              return next;
            })
          );
        }
      }
    },
    [apiBaseUrl, mergeUpdatedPhotos, setPhotos, setStatusMessage]
  );

  const handleSelectLevel = useCallback(
    (levelId) => {
      const normalizedLevelId = normalizeId(levelId);

      if (!normalizedLevelId) {
        return;
      }

      setActiveLevelId(normalizedLevelId);
      setStatusMessage(null);

      setSelectedPhotoId((current) => {
        if (!current) {
          return current;
        }

        const selected = photos.find((photo) => photo._id === current);
        const selectedLevelId = normalizeId(selected?.levelId);

        if (selectedLevelId && selectedLevelId === normalizedLevelId) {
          return current;
        }

        return null;
      });

      setLinkSourceId(null);
    },
    [photos, setLinkSourceId, setStatusMessage]
  );

  const handleAddLevel = useCallback(async () => {
    if (!activeProject?._id) {
      setStatusMessage({ type: 'error', message: 'Create or activate a project before adding levels.' });
      return;
    }

    setIsLevelRequestPending(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/projects/${activeProject._id}/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to create level');
      }

      const payload = await response.json();
      setActiveProject(payload.project);

      const createdLevelId = normalizeId(payload.levelId);
      if (createdLevelId) {
        setActiveLevelId(createdLevelId);
      } else if (Array.isArray(payload.project?.levels) && payload.project.levels.length > 0) {
        const fallbackLevel = payload.project.levels[payload.project.levels.length - 1];
        setActiveLevelId(normalizeId(fallbackLevel?._id));
      }

      setStatusMessage({ type: 'success', message: 'Level created.' });
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    } finally {
      setIsLevelRequestPending(false);
    }
  }, [activeProject, apiBaseUrl, setActiveLevelId, setActiveProject, setStatusMessage]);

  const handleRenameLevel = useCallback(async () => {
    if (!activeProject?._id || !resolvedActiveLevelId) {
      setStatusMessage({ type: 'error', message: 'Select a level before renaming it.' });
      return;
    }

    const currentName = activeLevel?.name || '';
    const nextName = window.prompt('Enter a new level name:', currentName);

    if (nextName === null) {
      return;
    }

    const trimmed = nextName.trim();

    if (!trimmed) {
      setStatusMessage({ type: 'error', message: 'Level name cannot be empty.' });
      return;
    }

    setIsLevelRequestPending(true);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/projects/${activeProject._id}/levels/${resolvedActiveLevelId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: trimmed }),
        }
      );

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to rename level');
      }

      const payload = await response.json();
      setActiveProject(payload.project);
      setStatusMessage({ type: 'success', message: `Renamed level to "${trimmed}".` });
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    } finally {
      setIsLevelRequestPending(false);
    }
  }, [activeLevel, activeProject, apiBaseUrl, resolvedActiveLevelId, setActiveProject, setStatusMessage]);

  // createLinkBetweenPhotos links two pano photos via the API and updates state.
  const createLinkBetweenPhotos = useCallback(
    async (sourceId, targetId) => {
      setIsLinkPending(true);

      const sourceLabel = photos.find((photo) => photo._id === sourceId)?.name || 'Photo';
      const targetLabel = photos.find((photo) => photo._id === targetId)?.name || 'Photo';

      try {
        const response = await fetch(`${apiBaseUrl}/api/panophotos/${sourceId}/link`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ targetId }),
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to create link');
        }

        const payload = await response.json();
        mergeUpdatedPhotos(payload.panophotos || []);
        setLinkSourceId(null);
        setSelectedPhotoId(targetId);
        setStatusMessage({
          type: 'success',
          message: `Linked "${sourceLabel}" with "${targetLabel}".`,
        });
      } catch (error) {
        setStatusMessage({ type: 'error', message: error.message });
      } finally {
        setIsLinkPending(false);
      }
    },
    [apiBaseUrl, mergeUpdatedPhotos, photos]
  );

  // handleSetStartPhoto assigns the selected photo as the project's start scene.
  const handleSetStartPhoto = useCallback(async () => {
    if (!selectedPhotoId || !activeProject?._id) {
      setStatusMessage({ type: 'error', message: 'Select a photo before setting the start scene.' });
      return;
    }

    if (startPhotoId && selectedPhotoId === startPhotoId) {
      setStatusMessage({ type: 'info', message: 'This photo is already the start scene.' });
      return;
    }

    const selectedLabel = selectedPhoto?.name || 'Photo';

    try {
      setStatusMessage(null);
      const response = await fetch(`${apiBaseUrl}/api/projects/${activeProject._id}/start`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ panophotoId: selectedPhotoId }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to update start photo');
      }

      const payload = await response.json();
      setActiveProject(payload.project);
      setStartPhotoId(normalizeId(payload.project?.startPanophoto) || null);
      setStatusMessage({ type: 'success', message: `Set "${selectedLabel}" as the start scene.` });
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    }
  }, [
    activeProject,
    apiBaseUrl,
    selectedPhoto,
    selectedPhotoId,
    startPhotoId,
  ]);

  const handleSetLevelStartPhoto = useCallback(async () => {
    if (!activeProject?._id || !resolvedActiveLevelId) {
      setStatusMessage({ type: 'error', message: 'Select a level before setting its start photo.' });
      return;
    }

    if (!selectedPhotoId) {
      setStatusMessage({ type: 'error', message: 'Select a photo before setting the level start.' });
      return;
    }

    const targetPhoto = photos.find((photo) => photo._id === selectedPhotoId);

    if (!targetPhoto) {
      setStatusMessage({ type: 'error', message: 'Unable to locate the selected photo.' });
      return;
    }

    const targetLevelId = normalizeId(targetPhoto.levelId);

    if (!targetLevelId || targetLevelId !== resolvedActiveLevelId) {
      setStatusMessage({
        type: 'error',
        message: 'Place this photo on the active level before setting it as the level start.',
      });
      return;
    }

    const storedLevelStartId = storedActiveLevelStartPhotoId;
    const currentResolvedStartId = levelStartPhotoIdMap.get(resolvedActiveLevelId) || null;
    const isResolvedStartMatch = Boolean(
      currentResolvedStartId && currentResolvedStartId === selectedPhotoId
    );

    if (storedLevelStartId && storedLevelStartId === selectedPhotoId) {
      setStatusMessage({ type: 'info', message: 'This photo is already the start for this level.' });
      return;
    }

    setIsLevelStartPending(true);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/projects/${activeProject._id}/levels/${resolvedActiveLevelId}/start`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ panophotoId: selectedPhotoId }),
        }
      );

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to set level start photo');
      }

      const payload = await response.json();
      setActiveProject(payload.project);
      setStatusMessage({
        type: 'success',
        message: `${isResolvedStartMatch && !storedLevelStartId ? 'Saved' : 'Set'} "${
          targetPhoto.name || 'Photo'
        }" as the start for ${activeLevel?.name || 'this level'}.`,
      });
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    } finally {
      setIsLevelStartPending(false);
    }
  }, [
    activeLevel,
    activeProject,
    apiBaseUrl,
    levelStartPhotoIdMap,
    photos,
    resolvedActiveLevelId,
    selectedPhotoId,
    storedActiveLevelStartPhotoId,
    setActiveProject,
    setStatusMessage,
  ]);

  const handlePlacePhotoOnLevel = useCallback(
    async (xPosition, yPosition) => {
      if (!selectedPhotoId) {
        setStatusMessage({ type: 'error', message: 'Select a photo before placing it on the canvas.' });
        return;
      }

      if (!resolvedActiveLevelId) {
        setStatusMessage({ type: 'error', message: 'Select a level before placing a photo on it.' });
        return;
      }

      const targetPhoto = photos.find((photo) => photo._id === selectedPhotoId);

      if (!targetPhoto) {
        setStatusMessage({ type: 'error', message: 'Unable to locate the selected photo.' });
        return;
      }

      const currentLevelId = normalizeId(targetPhoto.levelId) || null;

      const fallbackX = clamp01(targetPhoto?.xPosition ?? 0);
      const fallbackY = clamp01(targetPhoto?.yPosition ?? 0);

      const hasCustomX = Number.isFinite(xPosition);
      const hasCustomY = Number.isFinite(yPosition);

      const nextX = hasCustomX ? clamp01(xPosition) : fallbackX > 0 ? fallbackX : 0.5;
      const nextY = hasCustomY ? clamp01(yPosition) : fallbackY > 0 ? fallbackY : 0.5;

      setPhotos((prev) =>
        prev.map((photo) =>
          photo._id === selectedPhotoId
            ? {
                ...photo,
                xPosition: nextX,
                yPosition: nextY,
                levelId: resolvedActiveLevelId,
              }
            : photo
        )
      );

      await persistPhotoPosition(selectedPhotoId, nextX, nextY, {
        x: fallbackX,
        y: fallbackY,
        levelId: currentLevelId,
      }, {
        levelId: resolvedActiveLevelId,
        successMessage: `Placed "${targetPhoto.name || 'Photo'}" on ${
          activeLevel?.name || 'the active level'
        }.`,
      });

      setLinkSourceId(null);
    },
    [
      activeLevel,
      persistPhotoPosition,
      photos,
      resolvedActiveLevelId,
      selectedPhotoId,
      setLinkSourceId,
      setPhotos,
      setStatusMessage,
    ]
  );

  const handleUnplacePhoto = useCallback(async () => {
    if (!selectedPhotoId) {
      setStatusMessage({ type: 'error', message: 'Select a photo before unplacing it.' });
      return;
    }

    const targetPhoto = photos.find((photo) => photo._id === selectedPhotoId);

    if (!targetPhoto) {
      setStatusMessage({ type: 'error', message: 'Unable to locate the selected photo.' });
      return;
    }

    const currentLevelId = normalizeId(targetPhoto.levelId);

    if (!currentLevelId) {
      setStatusMessage({ type: 'info', message: 'Photo is already unplaced.' });
      return;
    }

    const fallback = {
      x: clamp01(targetPhoto?.xPosition ?? 0),
      y: clamp01(targetPhoto?.yPosition ?? 0),
      levelId: currentLevelId,
    };

    setPhotos((prev) =>
      prev.map((photo) =>
        photo._id === selectedPhotoId
          ? {
              ...photo,
              xPosition: 0,
              yPosition: 0,
              levelId: null,
            }
          : photo
      )
    );

    await persistPhotoPosition(selectedPhotoId, 0, 0, fallback, {
      levelId: null,
      successMessage: `Removed "${targetPhoto.name || 'Photo'}" from all levels.`,
    });

    setLinkSourceId(null);
  }, [persistPhotoPosition, photos, selectedPhotoId, setLinkSourceId, setPhotos, setStatusMessage]);

  const handleCanvasClick = useCallback(
    (event) => {
      if (event.defaultPrevented) {
        return;
      }

      const target = event.target;

      if (target instanceof Element && target.closest('.project-canvas-marker')) {
        return;
      }

      if (linkSourceId) {
        setStatusMessage({
          type: 'info',
          message: 'Select another photo to complete the link.',
        });
        return;
      }

      if (!selectedPhotoId) {
        setStatusMessage({
          type: 'error',
          message: 'Select a photo from the list before placing it on the canvas.',
        });
        return;
      }

      if (!resolvedActiveLevelId) {
        setStatusMessage({
          type: 'error',
          message: 'Create or select a level before placing a photo.',
        });
        return;
      }

      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;

      if (width <= 0 || height <= 0) {
        return;
      }

      const nativeEvent = event.nativeEvent;
      const clientX = nativeEvent.clientX;
      const clientY = nativeEvent.clientY;

      const relativeX = (clientX - bounds.left) / width;
      const relativeY = (clientY - bounds.top) / height;

      handlePlacePhotoOnLevel(relativeX, relativeY);
    },
    [
      handlePlacePhotoOnLevel,
      linkSourceId,
      resolvedActiveLevelId,
      selectedPhotoId,
      setStatusMessage,
    ]
  );

  // handleOpenViewer launches the viewer preloaded with the start scene id.
  const handleOpenViewer = useCallback(() => {
    if (!resolvedStartPhotoId) {
      setStatusMessage({ type: 'error', message: 'Add a pano photo before opening the viewer.' });
      return;
    }

    setStatusMessage(null);
    navigate(`/viewer?id=${resolvedStartPhotoId}`, {
      state: { panophotoId: resolvedStartPhotoId },
    });
  }, [navigate, resolvedStartPhotoId]);

  // handlePhotoSelect manages selection, link creation flow, and status resets.
  const handlePhotoSelect = useCallback(
    (photoId) => {
      if (isLinkPending || deletingPhotoIds.includes(photoId)) {
        return;
      }

      if (linkSourceId) {
        if (photoId === linkSourceId) {
          setLinkSourceId(null);
          setStatusMessage({ type: 'info', message: 'Linking cancelled.' });
          return;
        }

        createLinkBetweenPhotos(linkSourceId, photoId);
        return;
      }

      const targetPhoto = photos.find((photo) => photo._id === photoId);
      const targetLevelId = normalizeId(targetPhoto?.levelId);

      if (targetLevelId && targetLevelId !== resolvedActiveLevelId) {
        setActiveLevelId(targetLevelId);
      }

      setSelectedPhotoId(photoId);
      setStatusMessage(null);
    },
    [
      createLinkBetweenPhotos,
      deletingPhotoIds,
      isLinkPending,
      linkSourceId,
      photos,
      resolvedActiveLevelId,
      setActiveLevelId,
    ]
  );
  // handleDeletePhoto removes a pano photo and cleans up related state.
  const handleDeletePhoto = useCallback(
    async (photoId) => {
      const targetPhoto = photos.find((photo) => photo._id === photoId);
      const label = targetPhoto?.name || 'this photo';

      if (!window.confirm(`Delete "${label}" from this project? This cannot be undone.`)) {
        return;
      }

      setDeletingPhotoIds((prev) => (prev.includes(photoId) ? prev : [...prev, photoId]));
      setStatusMessage(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/panophotos/${photoId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to delete photo');
        }

        setPhotos((prev) =>
          prev
            .map((photo) => {
              if (!Array.isArray(photo.linkedPhotos) || photo.linkedPhotos.length === 0) {
                return photo;
              }

              const updatedLinks = photo.linkedPhotos.filter(
                (linked) => normalizeId(linked) !== photoId
              );

              if (updatedLinks.length === photo.linkedPhotos.length) {
                return photo;
              }

              return { ...photo, linkedPhotos: updatedLinks };
            })
            .filter((photo) => photo._id !== photoId)
        );

        if (photoId === startPhotoId) {
          setStartPhotoId(null);
        }

        if (activeProject?._id) {
          await loadActiveProject();
        }

        if (selectedPhotoId === photoId) {
          setSelectedPhotoId(null);
        }

        if (linkSourceId === photoId) {
          setLinkSourceId(null);
        }

        setStatusMessage({ type: 'success', message: `Deleted "${label}".` });
      } catch (error) {
        setStatusMessage({ type: 'error', message: error.message });
      } finally {
        setDeletingPhotoIds((prev) => prev.filter((id) => id !== photoId));
      }
    },
    [
      activeProject,
      apiBaseUrl,
      linkSourceId,
      loadActiveProject,
      photos,
      selectedPhotoId,
      startPhotoId,
    ]
  );


  // handleMarkerClick selects a marker while suppressing post-drag clicks.
  const handleMarkerClick = useCallback(
    (event, photoId) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.stopPropagation();
      handlePhotoSelect(photoId);
    },
    [handlePhotoSelect]
  );

  // handleLinkButtonClick toggles the linking workflow for the selected photo.
  const handleLinkButtonClick = () => {
    if (!selectedPhotoId || isLinkPending) {
      return;
    }

    if (linkSourceId) {
      setLinkSourceId(null);
      setStatusMessage({ type: 'info', message: 'Linking cancelled.' });
      return;
    }

    setLinkSourceId(selectedPhotoId);
    if (selectedPhoto) {
      setStatusMessage({
        type: 'info',
        message: `Select another photo to link with "${selectedPhoto.name}".`,
      });
    }
  };

  // handleUnlinkPhoto disconnects two linked photos via the API.
  const handleUnlinkPhoto = useCallback(
    async (targetId) => {
      if (!selectedPhotoId || isLinkPending) {
        return;
      }

      const sourceLabel = selectedPhoto?.name || 'Photo';
      const targetLabel = photos.find((photo) => photo._id === targetId)?.name || 'Photo';

      setIsLinkPending(true);

      try {
        const response = await fetch(`${apiBaseUrl}/api/panophotos/${selectedPhotoId}/unlink`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ targetId }),
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to remove link');
        }

        const payload = await response.json();
        mergeUpdatedPhotos(payload.panophotos || []);
        setStatusMessage({
          type: 'success',
          message: `Removed link between "${sourceLabel}" and "${targetLabel}".`,
        });
      } catch (error) {
        setStatusMessage({ type: 'error', message: error.message });
      } finally {
        setIsLinkPending(false);
      }
    },
    [apiBaseUrl, isLinkPending, mergeUpdatedPhotos, photos, selectedPhoto, selectedPhotoId]
  );

  // handleMarkerDragStart prepares drag state when a marker grab begins.
  const handleMarkerDragStart = useCallback(
    (event, photoId) => {
      if (!canvasRef.current) {
        return false;
      }

      if (linkSourceId || isLinkPending || deletingPhotoIds.includes(photoId)) {
        return false;
      }

  event.stopPropagation();

      setSelectedPhotoId((prev) => (prev === photoId ? prev : photoId));
      setStatusMessage(null);

      const targetPhoto = photos.find((photo) => photo._id === photoId);
      const startX = clamp01(targetPhoto?.xPosition ?? 0);
      const startY = clamp01(targetPhoto?.yPosition ?? 0);
      const startLevelId = normalizeId(targetPhoto?.levelId) || null;

      dragStateRef.current = {
        photoId,
        pointerId: event.pointerId,
        startPosition: { x: startX, y: startY },
        position: { x: startX, y: startY },
        hasMoved: false,
        levelId: startLevelId,
      };

      setDraggingPhotoId(photoId);
      return true;
    },
    [canvasRef, deletingPhotoIds, isLinkPending, linkSourceId, photos, setSelectedPhotoId, setStatusMessage]
  );

  // handleMarkerDrag updates marker coordinates in real time during dragging.
  const handleMarkerDrag = useCallback(
    (event, photoId) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.photoId !== photoId) {
        return;
      }

      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

  event.stopPropagation();

      const bounds = canvas.getBoundingClientRect();
      const { width, height, left, top } = bounds;

      if (width <= 0 || height <= 0) {
        return;
      }

      const relativeX = (event.clientX - left) / width;
      const relativeY = (event.clientY - top) / height;

      const clampedX = clamp01(relativeX);
      const clampedY = clamp01(relativeY);

      const startX = dragState.startPosition?.x ?? clampedX;
      const startY = dragState.startPosition?.y ?? clampedY;
      const deltaX = Math.abs(clampedX - startX);
      const deltaY = Math.abs(clampedY - startY);
      const hasMoved = dragState.hasMoved || deltaX + deltaY > 0.002;

      if (
        dragState.position &&
        !hasMoved &&
        Math.abs(clampedX - dragState.position.x) < 1e-4 &&
        Math.abs(clampedY - dragState.position.y) < 1e-4
      ) {
        return;
      }

      dragStateRef.current = {
        ...dragState,
        hasMoved,
        position: { x: clampedX, y: clampedY },
      };

      setPhotos((prev) =>
        prev.map((photo) =>
          photo._id === photoId ? { ...photo, xPosition: clampedX, yPosition: clampedY } : photo
        )
      );
    },
    [canvasRef, setPhotos]
  );

  // handleMarkerDragEnd finalizes a drag action and persists the new position.
  const handleMarkerDragEnd = useCallback(
    (event, metadata, photoId) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.photoId !== photoId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const isCancelled = Boolean(metadata?.cancelled);
      const startPosition = dragState.startPosition;
      const finalPosition = dragState.position;
      const hasMoved = dragState.hasMoved;
      const fallbackState = {
        x: startPosition?.x,
        y: startPosition?.y,
      };

      if (Object.prototype.hasOwnProperty.call(dragState, 'levelId')) {
        fallbackState.levelId = dragState.levelId;
      }

      dragStateRef.current = {
        photoId: null,
        pointerId: null,
        startPosition: null,
        position: null,
        hasMoved: false,
        levelId: null,
      };

      setDraggingPhotoId(null);

      if (isCancelled) {
        if (startPosition) {
          setPhotos((prev) =>
            prev.map((photo) =>
              photo._id === photoId
                ? { ...photo, xPosition: startPosition.x, yPosition: startPosition.y }
                : photo
            )
          );
        }
        return;
      }

      if (hasMoved && finalPosition) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);

        persistPhotoPosition(photoId, finalPosition.x, finalPosition.y, fallbackState, {
          levelId: resolvedActiveLevelId,
        });
      }
    },
    [persistPhotoPosition, resolvedActiveLevelId, setDraggingPhotoId, setPhotos]
  );

  if (!activeProject) {
    return (
      <div className="project-editor-page project-editor-empty">
        <h1>No Active Project</h1>
        <p>Use the Projects page to create or activate a project before managing photos.</p>
        <Link className="button-link" to="/projects">
          Go to Projects
        </Link>
        {statusMessage && (
          <p className={`panophoto-status ${statusMessage.type}`}>{statusMessage.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="project-editor-page">
      <div className="project-editor-main">
        <header className="project-editor-header">
          <div>
            <h1>{activeProject.name}</h1>
            {activeProject.description ? <p>{activeProject.description}</p> : null}
            <p className="project-start-summary">
              Start photo: {resolvedStartPhoto ? resolvedStartPhoto.name : 'Not set'}
            </p>
          </div>
          <div className="project-editor-header-actions">
            <button
              type="button"
              className="project-open-viewer-button"
              onClick={handleOpenViewer}
              disabled={!resolvedStartPhotoId}
            >
              Open Viewer
            </button>
            {/* Manage Projects link removed */}
          </div>
        </header>

        <section className="project-upload-panel">
          <ProjectPhotoUploadForm
            activeProjectId={activeProject?._id || null}
            apiBaseUrl={apiBaseUrl}
            onPhotosPrepend={prependUploadedPhotos}
            onReloadProject={loadActiveProject}
            setStatusMessage={setStatusMessage}
          />
          <ProjectBackgroundPanel
            activeProjectId={activeProject?._id || null}
            apiBaseUrl={apiBaseUrl}
            activeLevelName={activeLevel?.name || null}
            resolvedActiveLevelId={resolvedActiveLevelId}
            levelStartSummary={levelStartSummary}
            hasBackgroundImage={hasBackgroundImage}
            resolvedBackgroundUrl={resolvedBackgroundUrl}
            isBackgroundVisible={isBackgroundVisible}
            setIsBackgroundVisible={setIsBackgroundVisible}
            setStatusMessage={setStatusMessage}
            onProjectUpdate={setActiveProject}
            onActiveLevelChange={setActiveLevelId}
          />
        </section>

        <div className="project-editor-body">
          <ProjectPhotoBrowser
            photos={photos}
            selectedPhotoId={selectedPhotoId}
            resolvedStartPhotoId={resolvedStartPhotoId}
            linkSourceId={linkSourceId}
            deletingPhotoIds={deletingPhotoIds}
            resolvedActiveLevelId={resolvedActiveLevelId}
            levelNameById={levelNameById}
            levelStartPhotoIdMap={levelStartPhotoIdMap}
            onSelectPhoto={handlePhotoSelect}
            onDeletePhoto={handleDeletePhoto}
            normalizeId={normalizeId}
          />

          <ProjectCanvasPanel
            levels={levels}
            resolvedActiveLevelId={resolvedActiveLevelId}
            isLevelRequestPending={isLevelRequestPending}
            onSelectLevel={handleSelectLevel}
            onAddLevel={handleAddLevel}
            onRenameLevel={handleRenameLevel}
            canvasRef={canvasRef}
            shouldShowBackground={shouldShowBackground}
            resolvedBackgroundUrl={resolvedBackgroundUrl}
            canvasPaddingStyle={canvasPaddingStyle}
            onCanvasClick={handleCanvasClick}
            linkLines={linkLines}
            visiblePhotos={visiblePhotos}
            resolvedStartPhotoId={resolvedStartPhotoId}
            resolvedActiveLevelStartPhotoId={resolvedActiveLevelStartPhotoId}
            selectedPhotoId={selectedPhotoId}
            linkSourceId={linkSourceId}
            draggingPhotoId={draggingPhotoId}
            showCanvasLabels={showCanvasLabels}
            onMarkerClick={handleMarkerClick}
            onMarkerDragStart={handleMarkerDragStart}
            onMarkerDrag={handleMarkerDrag}
            onMarkerDragEnd={handleMarkerDragEnd}
            onLinkButtonClick={handleLinkButtonClick}
            isLinkPending={isLinkPending}
            onSetLevelStartPhoto={handleSetLevelStartPhoto}
            isSelectedOnActiveLevel={isSelectedOnActiveLevel}
            isLevelStartPending={isLevelStartPending}
            isSelectedStoredLevelStart={isSelectedStoredLevelStart}
            onSetStartPhoto={handleSetStartPhoto}
            isSelectedStoredStart={isSelectedStoredStart}
            onUnplacePhoto={handleUnplacePhoto}
            onToggleCanvasLabels={handleToggleCanvasLabels}
            linkingSourcePhoto={linkingSourcePhoto}
            selectedPhoto={selectedPhoto}
            photos={photos}
            onUnlinkPhoto={handleUnlinkPhoto}
          />
        </div>

        {statusMessage && (
          <p className={`panophoto-status ${statusMessage.type}`}>{statusMessage.message}</p>
        )}
      </div>
    </div>
  );
}

export default ProjectEditor;
