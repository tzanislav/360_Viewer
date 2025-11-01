import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../CSS/styles.css';

function Projects() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
  const [projects, setProjects] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingProjectIds, setDeletingProjectIds] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formState, setFormState] = useState({ name: '', description: '' });
  const navigate = useNavigate();

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/projects`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error('Failed to load projects');
      }

      const payload = await response.json();
      setProjects(payload.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
      setStatusMessage({ type: 'error', message: error.message });
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleFormFieldChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    if (!formState.name.trim()) {
      setStatusMessage({ type: 'error', message: 'Project name is required.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formState.name,
          description: formState.description,
        }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
        throw new Error(errorBody.message || 'Failed to create project');
      }

  await response.json();
  setFormState({ name: '', description: '' });
  setStatusMessage({ type: 'success', message: 'Project created and set as active.' });
  setShowCreateForm(false);
  await loadProjects();
  navigate('/projects/editor');
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activateAndOpen = async (projectId, isActive) => {
    try {
      if (!isActive) {
        const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/activate`, {
          method: 'PATCH',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to activate project');
        }

        await response.json();
        await loadProjects();
        setStatusMessage({ type: 'success', message: 'Project activated.' });
      }

      navigate('/projects/editor');
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message });
    }
  };

  const handleDeleteProject = useCallback(
    async (projectId) => {
      if (deletingProjectIds.includes(projectId)) {
        return;
      }

      if (!window.confirm('Delete this project? This cannot be undone.')) {
        return;
      }

      setDeletingProjectIds((prev) => [...prev, projectId]);
      setStatusMessage(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(async () => ({ message: (await response.text()) || 'Unknown error' }));
          throw new Error(errorBody.message || 'Failed to delete project');
        }

        const payload = await response.json().catch(() => ({}));
        setStatusMessage({ type: 'success', message: payload.message || 'Project deleted.' });
        await loadProjects();
      } catch (error) {
        setStatusMessage({ type: 'error', message: error.message });
      } finally {
        setDeletingProjectIds((prev) => prev.filter((id) => id !== projectId));
      }
    },
    [apiBaseUrl, deletingProjectIds, loadProjects]
  );

  return (
    <div className="projects-page">
      <header className="projects-header">
        <h1>Projects</h1>
        <button type="button" onClick={() => setShowCreateForm((prev) => !prev)}>
          {showCreateForm ? 'Cancel' : 'New Project'}
        </button>
      </header>

      {showCreateForm && (
        <form className="project-form" onSubmit={handleCreateProject}>
          <label>
            Name
            <input
              type="text"
              name="name"
              value={formState.name}
              onChange={handleFormFieldChange}
              required
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              value={formState.description}
              onChange={handleFormFieldChange}
              rows={3}
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create Project'}
          </button>
        </form>
      )}

      {statusMessage && (
        <p className={`panophoto-status ${statusMessage.type}`}>{statusMessage.message}</p>
      )}

      <div className="projects-grid">
        {projects.length === 0 ? (
          <p className="panophoto-status">No projects yet. Create one to get started.</p>
        ) : (
          projects.map((project) => (
            <div key={project._id} className={`project-card${project.isActive ? ' active' : ''}`}>
              <div className="project-card-content">
                <h2>{project.name}</h2>
                {project.description ? <p>{project.description}</p> : null}
                <p className="project-meta">Photos: {project.panophotos?.length ?? 0}</p>
                {project.isActive && <span className="project-badge">Active</span>}
              </div>
              <div className="project-card-actions">
                {project.isActive ? (
                  <button type="button" onClick={() => navigate('/projects/editor')}>
                    Open Editor
                  </button>
                ) : (
                  <button type="button" onClick={() => activateAndOpen(project._id, project.isActive)}>
                    Activate &amp; Open
                  </button>
                )}
                <button
                  type="button"
                  className="project-card-delete-button"
                  onClick={() => handleDeleteProject(project._id)}
                  disabled={deletingProjectIds.includes(project._id)}
                >
                  {deletingProjectIds.includes(project._id) ? 'Deleting…' : 'Delete Project'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Projects;
