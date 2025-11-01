import React, { useEffect, useState } from 'react';
import '../CSS/styles.css';

function UploadTest() {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    async function loadActiveProject() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/projects/active`, {
          credentials: 'include',
        });

        if (!response.ok) {
          return setActiveProject(null);
        }

        const payload = await response.json();
        setActiveProject(payload.project);
      } catch (error) {
        console.error('Failed to fetch active project:', error);
        setActiveProject(null);
      }
    }

    loadActiveProject();
  }, [apiBaseUrl]);

  const handleChange = (event) => {
    setName(event.target.value);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setStatus({ type: 'error', message: 'Please select an image file before submitting.' });
      return;
    }

    if (!activeProject) {
      setStatus({ type: 'error', message: 'Create or activate a project before uploading images.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    const formData = new FormData();

    formData.append('name', name);
    formData.append('image', file);

    try {
      const response = await fetch(`${apiBaseUrl}/api/panophotos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));

        if (response.status === 413) {
          throw new Error(errorBody.message || 'Image exceeds upload size limit (20 MB).');
        }

        throw new Error(errorBody.message || 'Failed to upload pano photo');
      }

      const payload = await response.json();
      setStatus({ type: 'success', message: `Upload successful. Stored id: ${payload?.panophoto?._id ?? 'unknown'}` });
      setName('');
      setFile(null);
      event.target.reset();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="upload-test-page">
      <h1>Upload Test Pano Photo</h1>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <label>
          Name
          <input
            type="text"
            name="name"
            value={name}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Image
          <input type="file" name="image" accept="image/*" onChange={handleFileChange} required />
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      {activeProject ? (
        <p className="upload-status">Active project: {activeProject.name}</p>
      ) : (
        <p className="upload-status error">No active project selected.</p>
      )}

      {status && (
        <p className={`upload-status ${status.type}`}>{status.message}</p>
      )}
    </div>
  );
}

export default UploadTest;
