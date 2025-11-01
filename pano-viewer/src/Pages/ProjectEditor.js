import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProjectCanvasMarker from '../Components/ProjectCanvasMarker';
import ProjectPhotoThumbnail from '../Components/ProjectPhotoThumbnail';
import '../CSS/styles.css';

const normalizeId = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value) {
    return '';
  }

  if (typeof value === 'object' && value.target !== undefined) {
    return normalizeId(value.target);
  }

  if (typeof value === 'object' && value._id) {
    return value._id.toString();
  }

  return value.toString();
};

const clamp01 = (value) => {
  const parsed = Number.parseFloat(value);

  if (Number.isFinite(parsed)) {
    return Math.min(1, Math.max(0, parsed));
  }

  return 0;
};

function ProjectEditor() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
  const navigate = useNavigate();
  const [activeProject, setActiveProject] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
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
  });
  const suppressClickRef = useRef(false);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [isBackgroundUploading, setIsBackgroundUploading] = useState(false);
  const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
  const [showCanvasLabels, setShowCanvasLabels] = useState(true);
  const backgroundInputRef = useRef(null);

  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo._id === selectedPhotoId),
    [photos, selectedPhotoId]
  );

  const linkingSourcePhoto = useMemo(
    () => photos.find((photo) => photo._id === linkSourceId),
    [photos, linkSourceId]
  );

  const linkLines = useMemo(() => {
    const segments = [];
    const seenPairs = new Set();

    photos.forEach((photo) => {
      if (!Array.isArray(photo.linkedPhotos) || photo.linkedPhotos.length === 0) {
        return;
      }

      photo.linkedPhotos.forEach((linkedRef) => {
        const linkedId = normalizeId(linkedRef);

        if (!linkedId) {
          return;
        }

        const partner = photos.find((candidate) => candidate._id === linkedId);

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
  }, [photos]);

  const fallbackStartPhoto = useMemo(() => {
    if (!Array.isArray(photos) || photos.length === 0) {
      return null;
    }

    const sorted = [...photos].sort((a, b) => {
      const aTimeRaw = new Date(a?.createdAt || 0).getTime();
      const bTimeRaw = new Date(b?.createdAt || 0).getTime();
      const aTime = Number.isFinite(aTimeRaw) ? aTimeRaw : 0;
      const bTime = Number.isFinite(bTimeRaw) ? bTimeRaw : 0;
      return aTime - bTime;
    });

    return sorted[0] || null;
  }, [photos]);

  const resolvedStartPhotoId = useMemo(() => {
    if (startPhotoId) {
      return startPhotoId;
    }

    return fallbackStartPhoto?._id || null;
  }, [startPhotoId, fallbackStartPhoto]);

  const resolvedStartPhoto = useMemo(() => {
    if (!resolvedStartPhotoId) {
      return null;
    }

    return (
      photos.find((photo) => photo._id === resolvedStartPhotoId) || fallbackStartPhoto || null
    );
  }, [photos, resolvedStartPhotoId, fallbackStartPhoto]);

  const isSelectedStoredStart = Boolean(selectedPhotoId && startPhotoId && selectedPhotoId === startPhotoId);
  const hasBackgroundImage = Boolean(activeProject?.canvasBackgroundImageUrl);
  const shouldShowBackground = hasBackgroundImage && isBackgroundVisible;

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
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
    setBackgroundFile(null);
    setIsBackgroundVisible(Boolean(activeProject?.canvasBackgroundImageUrl));
  }, [activeProject?.canvasBackgroundImageUrl]);

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

  const handleFileChange = (event) => {
    setUploadFiles(Array.from(event.target.files || []));
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!activeProject) {
      setStatusMessage({ type: 'error', message: 'Create or activate a project before uploading.' });
      return;
    }

    if (uploadFiles.length === 0) {
      setStatusMessage({ type: 'error', message: 'Select at least one image to upload.' });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    const formData = new FormData();
    uploadFiles.forEach((file) => formData.append('images', file));

    try {
      const response = await fetch(`${apiBaseUrl}/api/panophotos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to upload pano photos');
      }

      const payload = await response.json();
      setPhotos((prev) => [...payload.panophotos, ...prev]);
      setUploadFiles([]);
      event.target.reset();
      setStatusMessage({ type: 'success', message: `Uploaded ${payload.panophotos.length} photo(s).` });
      await loadActiveProject();
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackgroundFileChange = useCallback((event) => {
    const file = event.target?.files && event.target.files[0] ? event.target.files[0] : null;
    setBackgroundFile(file);
    setStatusMessage(null);
  }, [setBackgroundFile, setStatusMessage]);

  const handleBackgroundUpload = useCallback(async (event) => {
    event.preventDefault();

    if (!activeProject?._id) {
      setStatusMessage({ type: 'error', message: 'Create or activate a project before uploading a background.' });
      return;
    }

    if (!backgroundFile) {
      setStatusMessage({ type: 'error', message: 'Select an image to upload as the canvas background.' });
      return;
    }

    const formData = new FormData();
    formData.append('background', backgroundFile);

    setIsBackgroundUploading(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/projects/${activeProject._id}/background`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to upload canvas background');
      }

      const payload = await response.json();
      setActiveProject(payload.project);
      setIsBackgroundVisible(true);
      setStatusMessage({ type: 'success', message: 'Canvas background updated.' });
      setBackgroundFile(null);
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
      }
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    } finally {
      setIsBackgroundUploading(false);
    }
  }, [activeProject, apiBaseUrl, backgroundFile, setActiveProject, setIsBackgroundVisible, setStatusMessage]);

  const mergeUpdatedPhotos = useCallback((updatedList) => {
    if (!Array.isArray(updatedList) || updatedList.length === 0) {
      return;
    }

    setPhotos((prev) => {
      const updateMap = new Map(updatedList.map((photo) => [photo._id, photo]));
      return prev.map((photo) => (updateMap.has(photo._id) ? { ...photo, ...updateMap.get(photo._id) } : photo));
    });
  }, []);

  const handleDeleteBackground = useCallback(async () => {
    if (!activeProject?._id) {
      return;
    }

    if (!hasBackgroundImage) {
      setStatusMessage({ type: 'info', message: 'No background image to remove.' });
      return;
    }

    if (!window.confirm('Remove the canvas background image?')) {
      return;
    }

    setIsBackgroundUploading(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/projects/${activeProject._id}/background`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to remove canvas background');
      }

      const payload = await response.json();
      setActiveProject(payload.project);
      setIsBackgroundVisible(false);
      setBackgroundFile(null);
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
      }
      setStatusMessage({ type: 'success', message: 'Canvas background removed.' });
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    } finally {
      setIsBackgroundUploading(false);
    }
  }, [activeProject, apiBaseUrl, hasBackgroundImage, setActiveProject, setBackgroundFile, setIsBackgroundVisible, setStatusMessage]);

  const handleToggleBackgroundVisibility = useCallback(() => {
    if (!hasBackgroundImage) {
      return;
    }

    setIsBackgroundVisible((prev) => {
      const next = !prev;
      setStatusMessage({
        type: 'info',
        message: next ? 'Canvas background shown.' : 'Canvas background hidden.',
      });
      return next;
    });
  }, [hasBackgroundImage, setIsBackgroundVisible, setStatusMessage]);

  const handleToggleCanvasLabels = useCallback((event) => {
    setShowCanvasLabels(event.target.checked);
  }, [setShowCanvasLabels]);

  const persistPhotoPosition = useCallback(
    async (photoId, xPosition, yPosition, fallbackPosition) => {
      if (!photoId) {
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/panophotos/${photoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ xPosition, yPosition }),
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
        setStatusMessage({ type: 'success', message: 'Photo position updated.' });
      } catch (error) {
        setStatusMessage({ type: 'error', message: error.message });

        if (fallbackPosition && Number.isFinite(fallbackPosition.x) && Number.isFinite(fallbackPosition.y)) {
          setPhotos((prev) =>
            prev.map((photo) =>
              photo._id === photoId
                ? { ...photo, xPosition: fallbackPosition.x, yPosition: fallbackPosition.y }
                : photo
            )
          );
        }
      }
    },
    [apiBaseUrl, mergeUpdatedPhotos, setPhotos, setStatusMessage]
  );

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

      setSelectedPhotoId(photoId);
      setStatusMessage(null);
    },
    [createLinkBetweenPhotos, deletingPhotoIds, isLinkPending, linkSourceId]
  );
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

      dragStateRef.current = {
        photoId,
        pointerId: event.pointerId,
        startPosition: { x: startX, y: startY },
        position: { x: startX, y: startY },
        hasMoved: false,
      };

      setDraggingPhotoId(photoId);
      return true;
    },
    [canvasRef, deletingPhotoIds, isLinkPending, linkSourceId, photos, setSelectedPhotoId, setStatusMessage]
  );

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

      dragStateRef.current = {
        photoId: null,
        pointerId: null,
        startPosition: null,
        position: null,
        hasMoved: false,
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

        persistPhotoPosition(photoId, finalPosition.x, finalPosition.y, startPosition);
      }
    },
    [persistPhotoPosition, setDraggingPhotoId, setPhotos]
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
          <div>
            <h3>Upload Photos</h3>
            <p className="canvas-helper-text">
              Upload multiple images at once. Names and storage keys are generated automatically.
            </p>
          </div>
          <form onSubmit={handleUpload} className="project-upload-form">
            <input
              type="file"
              name="images"
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
            {uploadFiles.length > 0 && (
              <p className="project-upload-file-info">
                Selected files: {uploadFiles.map((file) => file.name).join(', ')}
              </p>
            )}
            <button type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading…' : 'Upload Photos'}
            </button>
          </form>
          <div className="project-background-panel">
            <h3>Canvas Background</h3>
            {hasBackgroundImage ? (
              <div
                className="project-background-preview"
                style={{ backgroundImage: `url(${activeProject.canvasBackgroundImageUrl})` }}
              />
            ) : (
              <p className="canvas-helper-text">No background image uploaded yet.</p>
            )}
            <form className="project-background-form" onSubmit={handleBackgroundUpload}>
              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundFileChange}
              />
              <button type="submit" disabled={!backgroundFile || isBackgroundUploading}>
                {isBackgroundUploading ? 'Uploading…' : 'Upload Background'}
              </button>
            </form>
            <div className="project-background-actions">
              <button
                type="button"
                onClick={handleToggleBackgroundVisibility}
                disabled={!hasBackgroundImage || isBackgroundUploading}
              >
                {shouldShowBackground ? 'Hide Background' : 'Show Background'}
              </button>
              <button
                type="button"
                onClick={handleDeleteBackground}
                disabled={!hasBackgroundImage || isBackgroundUploading}
              >
                Delete Background
              </button>
            </div>
          </div>
        </section>

        <div className="project-editor-body">
          <aside className="project-photo-panel">
            <h3>Photos</h3>
            {photos.length === 0 ? (
              <p className="panophoto-status">No photos in this project yet.</p>
            ) : (
              <div className="project-photo-grid">
                {photos.map((photo) => {
                  const imageUrl = photo.thumbnailUrl || photo.imageUrl;
                  const isDeleting = deletingPhotoIds.includes(photo._id);

                  return (
                    <ProjectPhotoThumbnail
                      key={photo._id}
                      label={photo.name}
                      imageUrl={imageUrl}
                      isSelected={photo._id === selectedPhotoId}
                      isLinkSource={linkSourceId === photo._id}
                      isStart={photo._id === resolvedStartPhotoId}
                      isBusy={isDeleting}
                      onClick={() => handlePhotoSelect(photo._id)}
                      onDelete={() => handleDeletePhoto(photo._id)}
                    />
                  );
                })}
              </div>
            )}
          </aside>

          <div className="project-canvas-wrapper">
            <div
              ref={canvasRef}
              className={`project-canvas${shouldShowBackground ? ' has-background' : ''}`}
            >
              {shouldShowBackground ? (
                <div
                  className="project-canvas-background"
                  style={{ backgroundImage: `url(${activeProject.canvasBackgroundImageUrl})` }}
                />
              ) : null}
              <svg className="project-canvas-links" viewBox="0 0 100 100" preserveAspectRatio="none">
                {linkLines.map((segment) => (
                  <line
                    key={segment.id}
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                    className="project-canvas-link-line"
                  />
                ))}
              </svg>
              {photos.map((photo) => (
                <ProjectCanvasMarker
                  key={photo._id}
                  label={photo.name}
                  x={photo.xPosition ?? 0}
                  y={photo.yPosition ?? 0}
                  isSelected={photo._id === selectedPhotoId}
                  isLinkSource={linkSourceId === photo._id}
                  isStart={photo._id === resolvedStartPhotoId}
                  isDragging={draggingPhotoId === photo._id}
                  showLabel={showCanvasLabels}
                  onClick={(event) => handleMarkerClick(event, photo._id)}
                  onDragStart={(event) => handleMarkerDragStart(event, photo._id)}
                  onDrag={(event) => handleMarkerDrag(event, photo._id)}
                  onDragEnd={(event, metadata) => handleMarkerDragEnd(event, metadata, photo._id)}
                />
              ))}
            </div>

            <div className="project-canvas-actions">
              <button
                type="button"
                className={`project-link-button${linkSourceId ? ' active' : ''}`}
                onClick={handleLinkButtonClick}
                disabled={!selectedPhotoId || isLinkPending}
              >
                {linkSourceId ? 'Cancel Linking' : 'Link Photos'}
              </button>
              <button
                type="button"
                className="project-start-button"
                onClick={handleSetStartPhoto}
                disabled={!selectedPhotoId || isLinkPending || isSelectedStoredStart}
              >
                {isSelectedStoredStart ? 'Start Scene' : 'Set as Start'}
              </button>
              <label className="project-canvas-toggle">
                <input
                  type="checkbox"
                  checked={showCanvasLabels}
                  onChange={handleToggleCanvasLabels}
                />
                Show photo names
              </label>
              {linkSourceId && linkingSourcePhoto ? (
                <span className="project-link-hint">
                  Select another photo to link with "{linkingSourcePhoto.name}".
                </span>
              ) : null}
            </div>

            {selectedPhoto?.linkedPhotos?.length ? (
              <div className="project-link-list-wrapper">
                <h4>Linked Photos</h4>
                <ul className="project-link-list">
                  {selectedPhoto.linkedPhotos.map((linkedItem) => {
                    const linkedId = normalizeId(linkedItem);

                    if (!linkedId) {
                      return null;
                    }

                    const linkedPhoto = photos.find((photo) => photo._id === linkedId);
                    const label = linkedPhoto?.name || 'Photo';

                    return (
                      <li key={linkedId} className="project-link-item">
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={() => handleUnlinkPhoto(linkedId)}
                          disabled={isLinkPending}
                        >
                          Remove Link
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <p className="canvas-helper-text">
              Select a photo, then drag its marker on the canvas to update its position.
            </p>
          </div>
        </div>

        {statusMessage && (
          <p className={`panophoto-status ${statusMessage.type}`}>{statusMessage.message}</p>
        )}
      </div>
    </div>
  );
}

export default ProjectEditor;
