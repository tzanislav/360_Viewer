import { useCallback, useRef, useState } from 'react';

const useAdjustModeState = () => {
  const [isAdjustModeActive, setIsAdjustModeActiveState] = useState(false);
  const [selectedTargetId, setSelectedTargetIdState] = useState(null);
  const [selectedMarkerLabel, setSelectedMarkerLabelState] = useState('');

  const adjustModeRef = useRef(isAdjustModeActive);
  const selectedTargetIdRef = useRef(selectedTargetId);

  const setAdjustModeActive = useCallback((value) => {
    adjustModeRef.current = value;
    setIsAdjustModeActiveState(value);
  }, []);

  const setSelectedTargetId = useCallback((value) => {
    selectedTargetIdRef.current = value;
    setSelectedTargetIdState(value);
  }, []);

  const setSelectedMarkerLabel = useCallback((value) => {
    setSelectedMarkerLabelState(value || '');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTargetId(null);
    setSelectedMarkerLabel('');
  }, [setSelectedMarkerLabel, setSelectedTargetId]);

  const resetAdjustModeState = useCallback(() => {
    setAdjustModeActive(false);
    clearSelection();
  }, [clearSelection, setAdjustModeActive]);

  const enableAdjustMode = useCallback(() => {
    setAdjustModeActive(true);
    clearSelection();
  }, [clearSelection, setAdjustModeActive]);

  const selectMarker = useCallback(
    (targetId, label = 'Linked photo') => {
      setSelectedTargetId(targetId);
      setSelectedMarkerLabel(label);
    },
    [setSelectedMarkerLabel, setSelectedTargetId]
  );

  return {
    isAdjustModeActive,
    adjustModeRef,
    selectedTargetId,
    selectedTargetIdRef,
    selectedMarkerLabel,
    setSelectedMarkerLabel,
    enableAdjustMode,
    resetAdjustModeState,
    clearSelection,
    selectMarker,
  };
};

export default useAdjustModeState;
