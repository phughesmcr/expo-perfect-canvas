import { useCallback, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  SharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Point } from '../types';

interface DrawingGestureConfig {
  onDrawStart?: (point: Point) => void;
  onDrawUpdate?: (point: Point) => void;
  onDrawEnd?: (points: Point[]) => void;
  enablePressure?: boolean;
  enableVelocity?: boolean;
  minDistance?: number;
}

export function useDrawingGesture(config: DrawingGestureConfig) {
  const {
    onDrawStart,
    onDrawUpdate,
    onDrawEnd,
    enablePressure = true,
    enableVelocity = true,
    minDistance = 1,
  } = config;

  const currentPath = useSharedValue<Point[]>([]);
  const lastPoint = useSharedValue<Point | null>(null);
  const lastTime = useSharedValue<number>(0);
  const isDrawing = useSharedValue<boolean>(false);

  const handleStart = useCallback((x: number, y: number, pressure?: number) => {
    'worklet';
    const now = Date.now();
    const point: Point = enablePressure && pressure !== undefined 
      ? [x, y, pressure] 
      : [x, y];
    
    currentPath.value = [point];
    lastPoint.value = point;
    lastTime.value = now;
    isDrawing.value = true;

    if (onDrawStart) {
      runOnJS(onDrawStart)(point);
    }
  }, [enablePressure, onDrawStart]);

  const handleUpdate = useCallback((x: number, y: number, pressure?: number) => {
    'worklet';
    if (!isDrawing.value || !lastPoint.value) return;

    const now = Date.now();
    const deltaTime = now - lastTime.value;
    
    // Calculate distance from last point
    const distance = Math.sqrt(
      Math.pow(x - lastPoint.value[0], 2) + 
      Math.pow(y - lastPoint.value[1], 2)
    );

    // Skip if movement is too small
    if (distance < minDistance) return;

    let finalPressure = pressure;
    
    // Calculate pressure from velocity if not provided (inline worklet)
    if (enableVelocity && pressure === undefined && deltaTime > 0) {
      const velocity = distance / deltaTime * 1000; // pixels per second
      const normalized = Math.min(1, velocity / 100);
      finalPressure = 1 - (normalized * 0.8); // max=1, min=0.2
    }

    const point: Point = enablePressure && finalPressure !== undefined
      ? [x, y, finalPressure]
      : [x, y];

    currentPath.value = [...currentPath.value, point];
    lastPoint.value = point;
    lastTime.value = now;

    if (onDrawUpdate) {
      runOnJS(onDrawUpdate)(point);
    }
  }, [enablePressure, enableVelocity, minDistance, onDrawUpdate]);

  const handleEnd = useCallback(() => {
    'worklet';
    if (!isDrawing.value) return;

    const points = [...currentPath.value];
    isDrawing.value = false;
    currentPath.value = [];
    lastPoint.value = null;

    // Always call onDrawEnd even for single tap (dot)
    if (onDrawEnd && points.length > 0) {
      runOnJS(onDrawEnd)(points);
    }
  }, [onDrawEnd]);

  const panGesture = Gesture.Pan()
    .minDistance(0) // Allow immediate recognition for taps
    .onBegin((e) => {
      handleStart(e.x, e.y);
    })
    .onUpdate((e) => {
      handleUpdate(e.x, e.y);
    })
    .onFinalize(() => {
      handleEnd();
    });

  return {
    gesture: panGesture,
    currentPath,
    isDrawing,
  };
}