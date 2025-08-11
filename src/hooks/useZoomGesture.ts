import { useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ZoomGestureConfig {
  enabled?: boolean;
  minScale?: number;
  maxScale?: number;
  onScaleChange?: (scale: number) => void;
  onTranslateChange?: (x: number, y: number) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

export function useZoomGesture(config: ZoomGestureConfig = {}) {
  const {
    enabled = true,
    minScale = 0.5,
    maxScale = 3,
    onScaleChange,
    onTranslateChange,
    canvasWidth = screenWidth,
    canvasHeight = screenHeight,
  } = config;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translation = useSharedValue({ x: 0, y: 0 });
  const savedTranslation = useSharedValue({ x: 0, y: 0 });
  const isPinching = useSharedValue(false);
  const isPanning = useSharedValue(false);
  const activeGesture = useSharedValue<'none' | 'pan' | 'pinch'>('none');

  // Pan gesture for two-finger panning
  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .minPointers(2)
    .maxPointers(2)
    .averageTouches(true)
    .onStart(() => {
      'worklet';
      savedTranslation.value = translation.value;
    })
    .onUpdate((e) => {
      'worklet';
      
      // Check if we should claim this gesture
      if (activeGesture.value === 'none') {
        // Claim pan if there's movement
        if (Math.abs(e.translationX) > 5 || Math.abs(e.translationY) > 5) {
          activeGesture.value = 'pan';
          isPanning.value = true;
        }
      }
      
      // Only update if this is the active gesture
      if (activeGesture.value === 'pan') {
        translation.value = {
          x: savedTranslation.value.x + e.translationX,
          y: savedTranslation.value.y + e.translationY,
        };

        if (onTranslateChange) {
          runOnJS(onTranslateChange)(translation.value.x, translation.value.y);
        }
      }
    })
    .onEnd(() => {
      'worklet';
      if (activeGesture.value === 'pan') {
        savedTranslation.value = translation.value;
      }
    })
    .onFinalize(() => {
      'worklet';
      if (activeGesture.value === 'pan') {
        isPanning.value = false;
        activeGesture.value = 'none';
      }
    });

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .enabled(enabled)
    .onStart((e) => {
      'worklet';
      // Don't immediately claim the gesture - wait for actual scaling
      savedScale.value = scale.value;
      savedTranslation.value = translation.value;
    })
    .onUpdate((e) => {
      'worklet';
      
      // Check if we should claim this gesture
      if (activeGesture.value === 'none') {
        // Only claim if there's significant scaling (not just two fingers on screen)
        if (Math.abs(e.scale - 1) > 0.05) {
          activeGesture.value = 'pinch';
          isPinching.value = true;
        }
      }
      
      // Only update if this is the active gesture
      if (activeGesture.value === 'pinch') {
        const newScale = savedScale.value * e.scale;
        
        if (newScale >= minScale && newScale <= maxScale) {
          // Update scale
          scale.value = newScale;
          
          // Get focal point (relative to the gesture detector/canvas)
          const focalX = e.focalX;
          const focalY = e.focalY;
          
          // Calculate what content point is under the focal point before scaling
          // Content point = (screen point - translation) / scale
          const contentX = (focalX - savedTranslation.value.x) / savedScale.value;
          const contentY = (focalY - savedTranslation.value.y) / savedScale.value;
          
          // After scaling, this same content point should still be at the focal point
          // focal = translation + content * scale
          // Therefore: translation = focal - content * scale
          translation.value = {
            x: focalX - contentX * newScale,
            y: focalY - contentY * newScale,
          };
          
          if (onScaleChange) {
            runOnJS(onScaleChange)(newScale);
          }
          
          if (onTranslateChange) {
            runOnJS(onTranslateChange)(translation.value.x, translation.value.y);
          }
        }
      }
    })
    .onEnd(() => {
      'worklet';
      if (activeGesture.value === 'pinch') {
        savedScale.value = scale.value;
        savedTranslation.value = translation.value;
      }
    })
    .onFinalize(() => {
      'worklet';
      if (activeGesture.value === 'pinch') {
        isPinching.value = false;
        activeGesture.value = 'none';
      }
    });

  // Make gestures work simultaneously
  panGesture.simultaneousWithExternalGesture(pinchGesture);
  pinchGesture.simultaneousWithExternalGesture(panGesture);

  const reset = useCallback((duration: number = 300) => {
    'worklet';
    scale.value = withTiming(1, { duration });
    savedScale.value = 1;
    translation.value = withTiming({ x: 0, y: 0 }, { duration });
    savedTranslation.value = { x: 0, y: 0 };
    isPinching.value = false;
    isPanning.value = false;
  }, []);

  const setScale = useCallback((newScale: number, animated: boolean = true) => {
    'worklet';
    const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);
    
    // Calculate center of screen as focal point
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Calculate what content point is at the center of the screen
    const contentX = (centerX - translation.value.x) / scale.value;
    const contentY = (centerY - translation.value.y) / scale.value;
    
    // Update scale
    if (animated) {
      scale.value = withTiming(clampedScale, { duration: 200 });
    } else {
      scale.value = clampedScale;
    }
    savedScale.value = clampedScale;
    
    // Keep the center point stationary by adjusting translation
    const newTranslationX = centerX - contentX * clampedScale;
    const newTranslationY = centerY - contentY * clampedScale;
    
    if (animated) {
      translation.value = withTiming(
        { x: newTranslationX, y: newTranslationY }, 
        { duration: 200 }
      );
    } else {
      translation.value = { x: newTranslationX, y: newTranslationY };
    }
    savedTranslation.value = { x: newTranslationX, y: newTranslationY };
    
    if (onScaleChange) {
      runOnJS(onScaleChange)(clampedScale);
    }
    
    if (onTranslateChange) {
      runOnJS(onTranslateChange)(newTranslationX, newTranslationY);
    }
  }, [minScale, maxScale, canvasWidth, canvasHeight, onScaleChange, onTranslateChange]);

  return {
    pinchGesture,
    panGesture,
    scale,
    translation,
    reset,
    setScale,
    isPinching,
    isPanning,
  };
}