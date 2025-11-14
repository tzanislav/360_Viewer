import { useMemo } from 'react';
import { normalizeId } from '../utils/panophotoMath';

function useProjectLevelDerivedState({
  activeProject,
  photos,
  selectedPhotoId,
  activeLevelId,
}) {
  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo._id === selectedPhotoId) || null,
    [photos, selectedPhotoId]
  );

  const levels = useMemo(() => {
    if (!Array.isArray(activeProject?.levels)) {
      return [];
    }

    return activeProject.levels;
  }, [activeProject?.levels]);

  const activeLevel = useMemo(() => {
    if (!levels.length) {
      return null;
    }

    if (activeLevelId) {
      const match = levels.find((level) => normalizeId(level?._id) === activeLevelId);
      if (match) {
        return match;
      }
    }

    return levels[0] || null;
  }, [levels, activeLevelId]);

  const resolvedActiveLevelId = useMemo(
    () => (activeLevel ? normalizeId(activeLevel._id) : null),
    [activeLevel]
  );

  const selectedPhotoLevelId = useMemo(
    () => normalizeId(selectedPhoto?.levelId),
    [selectedPhoto]
  );

  const isSelectedOnActiveLevel = useMemo(
    () =>
      Boolean(
        selectedPhotoLevelId && resolvedActiveLevelId && selectedPhotoLevelId === resolvedActiveLevelId
      ),
    [selectedPhotoLevelId, resolvedActiveLevelId]
  );

  const visiblePhotos = useMemo(() => {
    if (!resolvedActiveLevelId) {
      return [];
    }

    return photos.filter((photo) => normalizeId(photo.levelId) === resolvedActiveLevelId);
  }, [photos, resolvedActiveLevelId]);

  const visiblePhotoMap = useMemo(() => {
    const map = new Map();

    visiblePhotos.forEach((photo) => {
      map.set(photo._id, photo);
    });

    return map;
  }, [visiblePhotos]);

  const photosByLevel = useMemo(() => {
    const map = new Map();

    photos.forEach((photo) => {
      const levelId = normalizeId(photo.levelId);

      if (!levelId) {
        return;
      }

      if (!map.has(levelId)) {
        map.set(levelId, []);
      }

      map.get(levelId).push(photo);
    });

    map.forEach((list) => {
      list.sort((a, b) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return aTime - bTime;
      });
    });

    return map;
  }, [photos]);

  const levelStartPhotoIdMap = useMemo(() => {
    const map = new Map();

    if (!Array.isArray(levels) || levels.length === 0) {
      return map;
    }

    levels.forEach((level) => {
      const levelId = normalizeId(level?._id);

      if (!levelId) {
        return;
      }

      const storedId = normalizeId(level?.startPanophoto) || null;
      const levelPhotos = photosByLevel.get(levelId) || [];
      const storedMatch = storedId
        ? levelPhotos.find((photo) => normalizeId(photo?._id) === storedId)
        : null;

      if (storedMatch) {
        const normalizedStored = normalizeId(storedMatch?._id);

        if (normalizedStored) {
          map.set(levelId, normalizedStored);
          return;
        }
      }

      if (levelPhotos.length > 0) {
        const fallbackId = normalizeId(levelPhotos[0]?._id);

        if (fallbackId) {
          map.set(levelId, fallbackId);
        }
      }
    });

    return map;
  }, [levels, photosByLevel]);

  const levelNameById = useMemo(() => {
    const map = new Map();

    levels.forEach((level) => {
      const levelId = normalizeId(level?._id);

      if (levelId) {
        map.set(levelId, level.name || `Level ${(level.index ?? 0) + 1}`);
      }
    });

    return map;
  }, [levels]);

  const resolvedActiveLevelStartPhotoId = useMemo(() => {
    if (!resolvedActiveLevelId) {
      return null;
    }

    return levelStartPhotoIdMap.get(resolvedActiveLevelId) || null;
  }, [levelStartPhotoIdMap, resolvedActiveLevelId]);

  const resolvedActiveLevelStartPhoto = useMemo(() => {
    if (!resolvedActiveLevelStartPhotoId) {
      return null;
    }

    return photos.find((photo) => photo._id === resolvedActiveLevelStartPhotoId) || null;
  }, [photos, resolvedActiveLevelStartPhotoId]);

  const storedActiveLevelStartPhotoId = useMemo(
    () => normalizeId(activeLevel?.startPanophoto) || null,
    [activeLevel]
  );

  const isSelectedStoredLevelStart = useMemo(
    () =>
      Boolean(
        selectedPhotoId &&
          storedActiveLevelStartPhotoId &&
          selectedPhotoId === storedActiveLevelStartPhotoId
      ),
    [selectedPhotoId, storedActiveLevelStartPhotoId]
  );

  const firstLevelStartPhotoId = useMemo(() => {
    const firstLevel = levels[0];
    const firstLevelId = firstLevel ? normalizeId(firstLevel?._id) : null;

    if (!firstLevelId) {
      return null;
    }

    return levelStartPhotoIdMap.get(firstLevelId) || null;
  }, [levels, levelStartPhotoIdMap]);

  const firstLevelStartPhoto = useMemo(() => {
    if (!firstLevelStartPhotoId) {
      return null;
    }

    return photos.find((photo) => photo._id === firstLevelStartPhotoId) || null;
  }, [photos, firstLevelStartPhotoId]);

  const levelStartSummary = useMemo(() => {
    if (!resolvedActiveLevelId) {
      return '—';
    }

    if (resolvedActiveLevelStartPhoto) {
      const label = resolvedActiveLevelStartPhoto.name || 'Photo';

      if (storedActiveLevelStartPhotoId) {
        return label;
      }

      return `${label} (fallback)`;
    }

    return 'Not set';
  }, [
    resolvedActiveLevelId,
    resolvedActiveLevelStartPhoto,
    storedActiveLevelStartPhotoId,
  ]);

  return {
    selectedPhoto,
    levels,
    activeLevel,
    resolvedActiveLevelId,
    selectedPhotoLevelId,
    isSelectedOnActiveLevel,
    visiblePhotos,
    visiblePhotoMap,
    levelStartPhotoIdMap,
    levelNameById,
    resolvedActiveLevelStartPhotoId,
    resolvedActiveLevelStartPhoto,
    storedActiveLevelStartPhotoId,
    isSelectedStoredLevelStart,
    firstLevelStartPhotoId,
    firstLevelStartPhoto,
    levelStartSummary,
  };
}

export default useProjectLevelDerivedState;
