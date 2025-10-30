import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../CSS/styles.css';

function PanophotoList() {
  const [panophotos, setPanophotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
  const navigate = useNavigate();

  const loadPanophotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/panophotos`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to load pano photos');
      }

      const payload = await response.json();
      setPanophotos(payload.panophotos || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadPanophotos();
  }, [loadPanophotos]);

  const handleDelete = async (id) => {
    const shouldDelete = window.confirm('Delete this pano photo? This will remove the image from storage too.');

    if (!shouldDelete) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${apiBaseUrl}/api/panophotos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to delete pano photo');
      }

      setPanophotos((prev) => prev.filter((item) => item._id !== id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <div className="panophoto-list-page">
      <div className="panophoto-list-header">
        <h1>Pano Photos</h1>
        <button type="button" onClick={loadPanophotos} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="panophoto-status error">{error}</p>}

      {isLoading ? (
        <p className="panophoto-status">Loading…</p>
      ) : panophotos.length === 0 ? (
        <p className="panophoto-status">No pano photos stored yet.</p>
      ) : (
        <ul className="panophoto-list">
          {panophotos.map((panophoto) => (
            <li key={panophoto._id} className="panophoto-item">
              <div className="panophoto-item-content">
                {panophoto.thumbnailUrl || panophoto.imageUrl ? (
                  <img
                    className="panophoto-preview"
                    src={panophoto.thumbnailUrl || panophoto.imageUrl}
                    alt={`${panophoto.name} preview`}
                  />
                ) : (
                  <div className="panophoto-preview placeholder">No preview</div>
                )}
                <div className="panophoto-item-info">
                  <h2>{panophoto.name}</h2>
                  <p>Project: {panophoto.project}</p>
                  <p>
                    Position: ({panophoto.xPosition}, {panophoto.yPosition})
                  </p>
                  <a href={panophoto.imageUrl} target="_blank" rel="noreferrer">
                    View Image
                  </a>
                </div>
              </div>
              <div className="panophoto-actions">
                <button
                  type="button"
                  className="panophoto-open-button"
                  onClick={() => navigate('/viewer', { state: { src: panophoto.imageUrl } })}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="panophoto-delete-button"
                  onClick={() => handleDelete(panophoto._id)}
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PanophotoList;
