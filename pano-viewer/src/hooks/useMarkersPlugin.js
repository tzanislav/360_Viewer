import { useEffect } from 'react';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

const useMarkersPlugin = ({ viewerRef, markers, handleMarkerSelect, isViewerReady }) => {
  useEffect(() => {
    if (!isViewerReady) {
      return;
    }

    const instance = viewerRef.current;

    if (!instance) {
      return;
    }

    const markersPlugin = instance.getPlugin(MarkersPlugin);

    if (!markersPlugin) {
      return;
    }

    const listener = (event) => handleMarkerSelect(event);
    markersPlugin.addEventListener('select-marker', listener);

    return () => {
      markersPlugin.removeEventListener('select-marker', listener);
    };
  }, [handleMarkerSelect, isViewerReady, viewerRef]);

  useEffect(() => {
    if (!isViewerReady) {
      return;
    }

    const instance = viewerRef.current;

    if (!instance) {
      return;
    }

    const markersPlugin = instance.getPlugin(MarkersPlugin);

    if (!markersPlugin) {
      return;
    }

    if (typeof markersPlugin.setMarkers === 'function') {
      markersPlugin.setMarkers(markers);
      return;
    }

    if (typeof markersPlugin.clearMarkers === 'function') {
      markersPlugin.clearMarkers();
    }

    if (Array.isArray(markers)) {
      markers.forEach((marker) => {
        try {
          markersPlugin.addMarker(marker);
        } catch (error) {
          console.error('Failed to add marker:', error);
        }
      });
    }
  }, [isViewerReady, markers, viewerRef]);
};

export default useMarkersPlugin;
