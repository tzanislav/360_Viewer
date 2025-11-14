import React from 'react';
import { normalizeId, extractTargetId } from '../../utils/panophotoMath';

function ProjectLinkedList({ selectedPhoto, photos, isLinkPending, onUnlinkPhoto }) {
  const linkedEntries = Array.isArray(selectedPhoto?.linkedPhotos)
    ? selectedPhoto.linkedPhotos
    : [];

  if (linkedEntries.length === 0) {
    return null;
  }

  return (
    <div className="project-link-list-wrapper">
      <h4>Linked Photos</h4>
      <ul className="project-link-list">
        {linkedEntries.map((linkedItem) => {
          const linkedId = normalizeId(extractTargetId(linkedItem));

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
                onClick={() => onUnlinkPhoto(linkedId)}
                disabled={isLinkPending}
              >
                Remove Link
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ProjectLinkedList;
