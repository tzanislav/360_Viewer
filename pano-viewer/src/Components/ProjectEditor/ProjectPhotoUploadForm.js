import React, { useCallback, useState } from 'react';

function ProjectPhotoUploadForm({
    activeProjectId,
    apiBaseUrl,
    onPhotosPrepend,
    onReloadProject,
    setStatusMessage,
}) {
    const [uploadFiles, setUploadFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = useCallback((event) => {
        setUploadFiles(Array.from(event.target.files || []));
    }, []);

    const handleUpload = useCallback(
        async (event) => {
            event.preventDefault();

            if (!activeProjectId) {
                setStatusMessage({
                    type: 'error',
                    message: 'Create or activate a project before uploading.',
                });
                return;
            }

            if (uploadFiles.length === 0) {
                setStatusMessage({
                    type: 'error',
                    message: 'Select at least one image to upload.',
                });
                return;
            }

            const formElement = event.target;
            const formData = new FormData();
            uploadFiles.forEach((file) => formData.append('images', file));

            setIsUploading(true);
            setStatusMessage(null);

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
                const newPhotos = payload.panophotos || [];

                if (newPhotos.length > 0 && typeof onPhotosPrepend === 'function') {
                    onPhotosPrepend(newPhotos);
                }

                setUploadFiles([]);

                if (formElement && typeof formElement.reset === 'function') {
                    formElement.reset();
                }

                setStatusMessage({
                    type: 'success',
                    message: `Uploaded ${newPhotos.length} photo(s).`,
                });

                if (typeof onReloadProject === 'function') {
                    await onReloadProject();
                }
            } catch (error) {
                setStatusMessage({ type: 'error', message: error.message });
            } finally {
                setIsUploading(false);
            }
        },
        [activeProjectId, apiBaseUrl, onPhotosPrepend, onReloadProject, setStatusMessage, uploadFiles]
    );

    return (
        <div className="project-upload-card">
            <h3>Upload Photos</h3>
            <form onSubmit={handleUpload} className="project-upload-form">
                <input type="file" name="images" accept="image/*" multiple onChange={handleFileChange} />
                {uploadFiles.length > 0 && (
                    <p className="project-upload-file-info">
                        Selected files: {uploadFiles.map((file) => file.name).join(', ')}
                    </p>
                )}
                <button type="submit" disabled={isUploading}>
                    {isUploading ? 'Uploading…' : 'Upload Photos'}
                </button>
            </form>
        </div>
    );
}

export default ProjectPhotoUploadForm;
