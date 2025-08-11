import { useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

interface ZoomGestureConfig {
  enabled?: boolean;
  minScale?: number;
  maxScale?: number;
  onScaleChange?: (scale: number) => void;
  onTranslateChange?: (x: number, y: number) => void;
}

export function useZoomGesture(config: ZoomGestureConfig = {}) {
  const {
    enabled = true,
    minScale = 0.5,
    maxScale = 3,
    onScaleChange,
    onTranslateChange,
  } = config;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translation = useSharedValue({ x: 0, y: 0 });
  const savedTranslation = useSharedValue({ x: 0, y: 0 });
  const focalPoint = useSharedValue({ x: 0, y: 0 });

  const pinchGesture = Gesture.Pinch()
    .enabled(enabled)
    .onStart((e) => {
      'worklet';
      focalPoint.value = { x: e.focalX, y: e.focalY };
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = savedScale.value * e.scale;
      
      if (newScale >= minScale && newScale <= maxScale) {
        scale.value = newScale;
        
        // Adjust translation to zoom from focal point
        const deltaScale = newScale / savedScale.value;
        translation.value = {
          x: focalPoint.value.x - (focalPoint.value.x - savedTranslation.value.x) * deltaScale,
          y: focalPoint.value.y - (focalPoint.value.y - savedTranslation.value.y) * deltaScale,
        };

        if (onScaleChange) {
          runOnJS(onScaleChange)(newScale);
        }
      }
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslation.value = translation.value;
    });

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .minPointers(2)
    .maxPointers(2)
    .onUpdate((e) => {
      'worklet';
      translation.value = {
        x: savedTranslation.value.x + e.translationX,
        y: savedTranslation.value.y + e.translationY,
      };

      if (onTranslateChange) {
        runOnJS(onTranslateChange)(translation.value.x, translation.value.y);
      }
    })
    .onEnd(() => {
      'worklet';
      savedTranslation.value = translation.value;
    });

  const reset = useCallback((duration: number = 300) => {
    'worklet';
    scale.value = withTiming(1, { duration });
    savedScale.value = 1;
    translation.value = withTiming({ x: 0, y: 0 }, { duration });
    savedTranslation.value = { x: 0, y: 0 };
  }, []);

  return {
    pinchGesture,
    panGesture,
    scale,
    translation,
    reset,
  };
}