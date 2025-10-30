import React, { useState } from 'react';
import '../CSS/styles.css';

function UploadTest() {
  const [formState, setFormState] = useState({
    name: '',
    project: '',
    xPosition: '',
    yPosition: '',
  });
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
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

    setIsSubmitting(true);
    setStatus(null);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
    const formData = new FormData();

    formData.append('name', formState.name);
    formData.append('project', formState.project);
    formData.append('xPosition', formState.xPosition);
    formData.append('yPosition', formState.yPosition);
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
      setFormState({ name: '', project: '', xPosition: '', yPosition: '' });
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
            value={formState.name}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Project
          <input
            type="text"
            name="project"
            value={formState.project}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          X Position
          <input
            type="number"
            name="xPosition"
            value={formState.xPosition}
            onChange={handleChange}
            required
            step="any"
          />
        </label>

        <label>
          Y Position
          <input
            type="number"
            name="yPosition"
            value={formState.yPosition}
            onChange={handleChange}
            required
            step="any"
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

      {status && (
        <p className={`upload-status ${status.type}`}>{status.message}</p>
      )}
    </div>
  );
}

export default UploadTest;
