import { useMemo } from 'react';

function useCanvasBackgroundState({
  activeProject,
  activeLevel,
  isBackgroundVisible,
  canvasAspectRatio,
  defaultCanvasAspectRatio,
}) {
  const resolvedBackgroundUrl = useMemo(() => {
    if (activeLevel?.backgroundImageUrl) {
      return activeLevel.backgroundImageUrl;
    }

    const levelIndex = activeLevel?.index ?? 0;

    if (levelIndex === 0 && activeProject?.canvasBackgroundImageUrl) {
      return activeProject.canvasBackgroundImageUrl;
    }

    return null;
  }, [activeLevel, activeProject?.canvasBackgroundImageUrl]);

  const hasBackgroundImage = useMemo(
    () => Boolean(resolvedBackgroundUrl),
    [resolvedBackgroundUrl]
  );

  const shouldShowBackground = useMemo(
    () => hasBackgroundImage && isBackgroundVisible,
    [hasBackgroundImage, isBackgroundVisible]
  );

  const resolvedCanvasAspectRatio = useMemo(() => {
    if (!Number.isFinite(canvasAspectRatio) || canvasAspectRatio <= 0) {
      return defaultCanvasAspectRatio;
    }

    return Math.min(Math.max(canvasAspectRatio, 0.25), 4);
  }, [canvasAspectRatio, defaultCanvasAspectRatio]);

  const canvasPaddingStyle = useMemo(
    () => ({ paddingTop: `${resolvedCanvasAspectRatio * 100}%` }),
    [resolvedCanvasAspectRatio]
  );

  return {
    resolvedBackgroundUrl,
    hasBackgroundImage,
    shouldShowBackground,
    resolvedCanvasAspectRatio,
    canvasPaddingStyle,
  };
}

export default useCanvasBackgroundState;
