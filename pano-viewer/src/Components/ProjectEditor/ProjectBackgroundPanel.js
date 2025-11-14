import React, { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeId } from '../../utils/panophotoMath';

function ProjectBackgroundPanel({
    activeProjectId,
    apiBaseUrl,
    activeLevelName,
    resolvedActiveLevelId,
    levelStartSummary,
    hasBackgroundImage,
    resolvedBackgroundUrl,
    isBackgroundVisible,
    setIsBackgroundVisible,
    setStatusMessage,
    onProjectUpdate,
    onActiveLevelChange,
}) {
    const [backgroundFile, setBackgroundFile] = useState(null);
    const [isBackgroundUploading, setIsBackgroundUploading] = useState(false);
    const backgroundInputRef = useRef(null);

    useEffect(() => {
        if (backgroundInputRef.current) {
            backgroundInputRef.current.value = '';
        }
        setBackgroundFile(null);
    }, [resolvedBackgroundUrl]);

    const handleBackgroundFileChange = useCallback((event) => {
        const file = event.target?.files && event.target.files[0] ? event.target.files[0] : null;
        setBackgroundFile(file);
        setStatusMessage(null);
    }, [setStatusMessage]);

    const handleBackgroundUpload = useCallback(
        async (event) => {
            event.preventDefault();

            if (!activeProjectId) {
                setStatusMessage({
                    type: 'error',
                    message: 'Create or activate a project before uploading a background.',
                });
                return;
            }

            if (!resolvedActiveLevelId) {
                setStatusMessage({
                    type: 'error',
                    message: 'Select a level before uploading a background.',
                });
                return;
            }

            if (!backgroundFile) {
                setStatusMessage({
                    type: 'error',
                    message: 'Select an image to upload as the canvas background.',
                });
                return;
            }

            const formData = new FormData();
            formData.append('background', backgroundFile);
            formData.append('levelId', resolvedActiveLevelId);

            setIsBackgroundUploading(true);
            setStatusMessage(null);

            try {
                const response = await fetch(`${apiBaseUrl}/api/projects/${activeProjectId}/background`, {
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

                if (payload.project && typeof onProjectUpdate === 'function') {
                    onProjectUpdate(payload.project);
                }

                if (payload.levelId && typeof onActiveLevelChange === 'function') {
                    onActiveLevelChange(normalizeId(payload.levelId));
                }

                if (typeof setIsBackgroundVisible === 'function') {
                    setIsBackgroundVisible(true);
                }

                setStatusMessage({
                    type: 'success',
                    message: `Background updated for ${activeLevelName || 'the active level'}.`,
                });

                setBackgroundFile(null);
                if (backgroundInputRef.current) {
                    backgroundInputRef.current.value = '';
                }
            } catch (error) {
                setStatusMessage({ type: 'error', message: error.message });
            } finally {
                setIsBackgroundUploading(false);
            }
        },
        [
            activeLevelName,
            activeProjectId,
            apiBaseUrl,
            backgroundFile,
            onActiveLevelChange,
            onProjectUpdate,
            resolvedActiveLevelId,
            setIsBackgroundVisible,
            setStatusMessage,
        ]
    );

    const handleDeleteBackground = useCallback(async () => {
        if (!activeProjectId) {
            return;
        }

        if (!resolvedActiveLevelId) {
            setStatusMessage({
                type: 'error',
                message: 'Select a level before removing its background.',
            });
            return;
        }

        if (!hasBackgroundImage) {
            setStatusMessage({
                type: 'info',
                message: 'No background image to remove for this level.',
            });
            return;
        }

        if (
            !window.confirm(`Remove the background image for ${activeLevelName || 'this level'}?`)
        ) {
            return;
        }

        setIsBackgroundUploading(true);
        setStatusMessage(null);

        try {
            const response = await fetch(
                `${apiBaseUrl}/api/projects/${activeProjectId}/background?levelId=${resolvedActiveLevelId}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                const errorBody = await response
                    .json()
                    .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
                throw new Error(errorBody.message || 'Failed to remove canvas background');
            }

            const payload = await response.json();

            if (payload.project && typeof onProjectUpdate === 'function') {
                onProjectUpdate(payload.project);
            }

            if (payload.levelId && typeof onActiveLevelChange === 'function') {
                onActiveLevelChange(normalizeId(payload.levelId));
            }

            if (typeof setIsBackgroundVisible === 'function') {
                setIsBackgroundVisible(false);
            }

            setBackgroundFile(null);
            if (backgroundInputRef.current) {
                backgroundInputRef.current.value = '';
            }

            setStatusMessage({
                type: 'success',
                message: `Background removed from ${activeLevelName || 'the active level'}.`,
            });
        } catch (error) {
            setStatusMessage({ type: 'error', message: error.message });
        } finally {
            setIsBackgroundUploading(false);
        }
    }, [
        activeLevelName,
        activeProjectId,
        apiBaseUrl,
        hasBackgroundImage,
        onActiveLevelChange,
        onProjectUpdate,
        resolvedActiveLevelId,
        setIsBackgroundVisible,
        setStatusMessage,
    ]);

    const handleToggleBackgroundVisibility = useCallback(() => {
        if (!hasBackgroundImage || isBackgroundUploading || typeof setIsBackgroundVisible !== 'function') {
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
    }, [hasBackgroundImage, isBackgroundUploading, setIsBackgroundVisible, setStatusMessage]);

    return (
        <div className="project-upload-card">
            <h3>Canvas Background</h3>
            {hasBackgroundImage ? null : (
                <p className="canvas-helper-text">No background image uploaded yet.</p>
            )}
            <form className="project-upload-form" onSubmit={handleBackgroundUpload}>
                <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundFileChange}
                />
                {backgroundFile ? (
                    <p className="project-upload-file-info">Selected file: {backgroundFile.name}</p>
                ) : null}
                <button type="submit" disabled={!backgroundFile || isBackgroundUploading}>
                    {isBackgroundUploading ? 'Uploading…' : 'Upload Background'}
                </button>
            </form>

            <div className="project-upload-actions">
                <button
                    type="button"
                    onClick={handleToggleBackgroundVisibility}
                    disabled={!hasBackgroundImage || isBackgroundUploading}
                >
                    {isBackgroundVisible ? 'Hide Background' : 'Show Background'}
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
    );
}

export default ProjectBackgroundPanel;
