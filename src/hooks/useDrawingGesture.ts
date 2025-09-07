import { useCallback } from "react";
import { Gesture, PanGesture } from "react-native-gesture-handler";
import { useSharedValue, SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Point } from "../types";

interface DrawingGestureConfig {
  onDrawStart?: (point: Point) => void;
  onDrawUpdate?: (point: Point) => void;
  onDrawEnd?: (points: Point[]) => void;
  enablePressure?: boolean;
  enableVelocity?: boolean;
  minDistance?: number;
  scale?: SharedValue<number>;
  translation?: SharedValue<{ x: number; y: number }>;
  isPinching?: SharedValue<boolean>;
  isPanning?: SharedValue<boolean>;
}

interface DrawingGestureResult {
  gesture: PanGesture;
  currentPath: SharedValue<Point[]>;
  isDrawing: SharedValue<boolean>;
}

export function useDrawingGesture(
  config: DrawingGestureConfig
): DrawingGestureResult {
  const {
    onDrawStart,
    onDrawUpdate,
    onDrawEnd,
    enablePressure = true,
    enableVelocity = true,
    minDistance = 1,
    scale,
    translation,
    isPinching,
    isPanning,
  } = config;

  const currentPath = useSharedValue<Point[]>([]);
  const lastPoint = useSharedValue<Point | null>(null);
  const lastTime = useSharedValue<number>(0);
  const isDrawing = useSharedValue<boolean>(false);
  const multiTouchEndTime = useSharedValue<number>(0);

  const handleStart = useCallback(
    (x: number, y: number, pressure?: number): void => {
      "worklet";

      // Convert screen coordinates to world coordinates
      // Simple: just reverse the transformation
      let transformedX = x;
      let transformedY = y;

      if (scale && translation) {
        transformedX = (x - translation.value.x) / scale.value;
        transformedY = (y - translation.value.y) / scale.value;
      }

      const now = Date.now();
      const point: Point =
        enablePressure && pressure !== undefined
          ? [transformedX, transformedY, pressure]
          : [transformedX, transformedY];

      currentPath.value = [point];
      lastPoint.value = point;
      lastTime.value = now;
      isDrawing.value = true;

      // Clear the multi-touch end time since we're successfully drawing
      multiTouchEndTime.value = 0;

      if (onDrawStart) {
        scheduleOnRN(onDrawStart, point);
      }
    },
    [enablePressure, onDrawStart, scale, translation]
  );

  const handleUpdate = useCallback(
    (x: number, y: number, pressure?: number): void => {
      "worklet";

      if (!isDrawing.value || !lastPoint.value) return;

      // Convert screen coordinates to world coordinates
      // Simple: just reverse the transformation
      let transformedX = x;
      let transformedY = y;

      if (scale && translation) {
        transformedX = (x - translation.value.x) / scale.value;
        transformedY = (y - translation.value.y) / scale.value;
      }

      const now = Date.now();
      const deltaTime = now - lastTime.value;

      // Calculate distance from last point
      const distance = Math.sqrt(
        Math.pow(transformedX - lastPoint.value[0], 2) +
          Math.pow(transformedY - lastPoint.value[1], 2)
      );

      // Skip if movement is too small
      if (distance < minDistance) return;

      let finalPressure = pressure;

      // Calculate pressure from velocity if not provided (inline worklet)
      if (enableVelocity && pressure === undefined && deltaTime > 0) {
        const velocity = (distance / deltaTime) * 1000; // pixels per second
        const normalized = Math.min(1, velocity / 100);
        finalPressure = 1 - normalized * 0.8; // max=1, min=0.2
      }

      const point: Point =
        enablePressure && finalPressure !== undefined
          ? [transformedX, transformedY, finalPressure]
          : [transformedX, transformedY];

      currentPath.value = [...currentPath.value, point];
      lastPoint.value = point;
      lastTime.value = now;

      if (onDrawUpdate) {
        scheduleOnRN(onDrawUpdate, point);
      }
    },
    [
      enablePressure,
      enableVelocity,
      minDistance,
      onDrawUpdate,
      scale,
      translation,
    ]
  );

  const handleEnd = useCallback((): void => {
    "worklet";
    if (!isDrawing.value) return;

    const points = [...currentPath.value];
    isDrawing.value = false;
    currentPath.value = [];
    lastPoint.value = null;

    // Always call onDrawEnd even for single tap (dot)
    if (onDrawEnd && points.length > 0) {
      scheduleOnRN(onDrawEnd, points);
    }
  }, [onDrawEnd]);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e): void => {
      "worklet";

      // Check if we recently ended a multi-touch gesture
      // This prevents accidental drawing when lifting fingers
      const now = Date.now();
      if (isPanning && isPanning.value) {
        multiTouchEndTime.value = now;
        return;
      }
      if (isPinching && isPinching.value) {
        multiTouchEndTime.value = now;
        return;
      }

      // Don't start drawing if we just finished a multi-touch gesture (within 100ms)
      if (now - multiTouchEndTime.value < 100) {
        return;
      }

      handleStart(e.x, e.y);
    })
    .onUpdate((e): void => {
      "worklet";

      // Don't update if we're in a multi-touch gesture
      if (isPanning && isPanning.value) return;
      if (isPinching && isPinching.value) return;

      handleUpdate(e.x, e.y);
    })
    .onEnd((): void => {
      "worklet";
      handleEnd();
    })
    .onFinalize((): void => {
      "worklet";

      // Track when multi-touch gestures end
      if (isPanning && !isPanning.value && multiTouchEndTime.value === 0) {
        multiTouchEndTime.value = Date.now();
      }
      if (isPinching && !isPinching.value && multiTouchEndTime.value === 0) {
        multiTouchEndTime.value = Date.now();
      }
    });

  return {
    gesture: panGesture,
    currentPath,
    isDrawing,
  };
}
