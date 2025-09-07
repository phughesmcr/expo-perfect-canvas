import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  Canvas,
  Path,
  Group,
  useCanvasRef,
  ImageFormat,
  Skia,
  SkImage,
  SkMatrix,
} from "@shopify/react-native-skia";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
  SimultaneousGesture,
  PanGesture,
} from "react-native-gesture-handler";
import { useSharedValue, useDerivedValue } from "react-native-reanimated";
import { View, StyleSheet } from "react-native";
import type {
  PerfectCanvasProps,
  PerfectCanvasRef,
  PathData,
  Point,
  DrawingState,
  StrokeOptions,
  HapticStyle,
} from "../types";
import {
  generateId,
  processPoints,
  simplifyPath,
  createSvgFromPaths,
  HistoryManager,
} from "../utils";
import { useHaptics, useDrawingGesture, useZoomGesture } from "../hooks";

const PerfectCanvasComponent = forwardRef<PerfectCanvasRef, PerfectCanvasProps>(
  (props, ref): React.ReactElement => {
    const {
      style,
      backgroundColor = "white",
      strokeColor: propStrokeColor = "black",
      strokeWidth: propStrokeWidth = 8,
      strokeOpacity: propStrokeOpacity = 1,
      strokeOptions = {},
      enableHaptics = true,
      hapticStyle = "light",
      enableZoom = false,
      zoomRange = [0.5, 3],
      // enableRotation = false,
      maxHistorySize = 50,
      // debounceDelay = 0,
      simplifyPaths = true,
      simplifyTolerance = 1,
      renderMode = "continuous",
      onDrawStart,
      onDrawUpdate,
      onDrawEnd,
      onPathComplete,
      // onStateChange,
      onZoomChange,
      onTranslateChange,
      // onRotationChange,
      children,
      // debug = false,
    } = props;

    // State
    const [paths, setPaths] = useState<PathData[]>([]);
    const [currentStrokeColor, setCurrentStrokeColor] = useState(
      typeof propStrokeColor === "string" ? propStrokeColor : "black"
    );
    const [currentStrokeWidth, setCurrentStrokeWidth] = useState(
      typeof propStrokeWidth === "number" ? propStrokeWidth : 8
    );
    const [currentStrokeOpacity, setCurrentStrokeOpacity] = useState(
      typeof propStrokeOpacity === "number" ? propStrokeOpacity : 1
    );
    const [currentBackgroundColor, setCurrentBackgroundColor] =
      useState(backgroundColor);
    const [hapticsEnabled, setHapticsEnabled] = useState(enableHaptics);
    const [currentHapticStyle, setCurrentHapticStyle] = useState(hapticStyle);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // Refs
    const canvasRef = useCanvasRef();
    const historyManager = useRef(new HistoryManager(maxHistorySize));
    const currentPathPoints = useRef<Point[]>([]);
    const isDrawingRef = useRef(false);
    const lastDrawTime = useRef<number>(0);
    const lastDrawPoint = useRef<Point | null>(null);

    // Shared values for animated props
    const strokeColorShared = useSharedValue(currentStrokeColor);
    const strokeWidthShared = useSharedValue(currentStrokeWidth);
    const currentPathShared = useSharedValue<string>("");

    // Haptics
    const {
      triggerHaptic,
      triggerDrawingHaptic,
      triggerSelection,
      triggerNotification,
    } = useHaptics({
      enabled: hapticsEnabled,
      style: currentHapticStyle,
    });

    // Stroke options with defaults
    const finalStrokeOptions: StrokeOptions = useMemo(
      (): StrokeOptions => ({
        size: currentStrokeWidth,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        ...strokeOptions,
      }),
      [currentStrokeWidth, strokeOptions]
    );

    // Drawing callbacks
    const handleDrawStart = useCallback(
      (point: Point): void => {
        isDrawingRef.current = true;
        currentPathPoints.current = [point];
        lastDrawPoint.current = point;
        lastDrawTime.current = Date.now();

        if (hapticsEnabled) {
          // Strong haptic feedback when starting to draw
          triggerHaptic(0.7);
        }

        onDrawStart?.(point);
      },
      [hapticsEnabled, triggerHaptic, onDrawStart]
    );

    const handleDrawUpdate = useCallback(
      (point: Point): void => {
        if (!isDrawingRef.current) return;

        currentPathPoints.current.push(point);

        // Throttle haptic feedback to improve performance
        if (hapticsEnabled && lastDrawPoint.current) {
          const now = Date.now();
          const deltaTime = now - lastDrawTime.current;

          // Only trigger haptics every 20ms to reduce overhead
          if (deltaTime > 20) {
            const dx = point[0] - lastDrawPoint.current[0];
            const dy = point[1] - lastDrawPoint.current[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            const velocity = (distance / deltaTime) * 1000;
            const pressure = point[2] || 0.5;

            triggerDrawingHaptic(velocity, pressure);
            lastDrawTime.current = now;
          }

          lastDrawPoint.current = point;
        }

        // Process points and update current path
        // Only update if we have enough points to prevent jumps
        if (currentPathPoints.current.length > 1) {
          const svgPath = processPoints(
            currentPathPoints.current,
            finalStrokeOptions
          );
          currentPathShared.value = svgPath;
        }

        // Call onDrawUpdate callback
        onDrawUpdate?.(point);
      },
      [hapticsEnabled, triggerDrawingHaptic, finalStrokeOptions, onDrawUpdate]
    );

    const handleDrawEnd = useCallback(
      (points: Point[]): void => {
        // Allow single point (dot) by duplicating it
        if (points.length === 1) {
          // Create a small dot by adding a point very close to the first one
          const dot = points[0];
          points = [dot, [dot[0] + 0.1, dot[1] + 0.1, dot[2]]];
        }

        if (points.length === 0) {
          isDrawingRef.current = false;
          currentPathShared.value = "";
          return;
        }

        // Simplify path if enabled
        const finalPoints = simplifyPaths
          ? simplifyPath(points, simplifyTolerance)
          : points;

        // Process final path
        const svgPath = processPoints(finalPoints, finalStrokeOptions);

        const newPath: PathData = {
          id: generateId(),
          points: finalPoints,
          svgPath,
          color: currentStrokeColor,
          width: currentStrokeWidth,
          opacity: currentStrokeOpacity,
          completed: true,
        };

        // Update state
        setPaths((prev): PathData[] => {
          const newPaths = [...prev, newPath];
          historyManager.current.push(newPaths);

          // Clear current path after state update to avoid blink
          requestAnimationFrame((): void => {
            currentPathShared.value = "";
          });

          return newPaths;
        });

        // Clear other drawing state
        currentPathPoints.current = [];
        isDrawingRef.current = false;
        lastDrawPoint.current = null;

        if (hapticsEnabled) {
          // Subtle haptic when lifting the finger
          triggerHaptic(0.3);
        }

        onDrawEnd?.(newPath);
        onPathComplete?.(newPath);
      },
      [
        simplifyPaths,
        simplifyTolerance,
        finalStrokeOptions,
        currentStrokeColor,
        currentStrokeWidth,
        currentStrokeOpacity,
        hapticsEnabled,
        triggerSelection,
        onDrawEnd,
        onPathComplete,
      ]
    );

    // Zoom gesture - always call the hook
    const {
      combinedGesture,
      // pinchGesture,
      // panGesture,
      scale,
      translation,
      reset: resetZoom,
      setScale,
      isPinching,
      isPanning,
    } = useZoomGesture({
      enabled: enableZoom,
      minScale: zoomRange[0],
      maxScale: zoomRange[1],
      onScaleChange: onZoomChange,
      onTranslateChange: onTranslateChange,
      canvasWidth: canvasSize.width || undefined,
      canvasHeight: canvasSize.height || undefined,
    });

    // Drawing gesture - pass zoom values only when zoom is enabled
    const { gesture: drawingGesture } = useDrawingGesture({
      onDrawStart: handleDrawStart,
      onDrawUpdate: handleDrawUpdate,
      onDrawEnd: handleDrawEnd,
      enablePressure: true,
      enableVelocity: true,
      minDistance: 0.0,
      scale: enableZoom ? scale : undefined,
      translation: enableZoom ? translation : undefined,
      isPinching: enableZoom ? isPinching : undefined,
      isPanning: enableZoom ? isPanning : undefined,
    });

    // Combine gestures - drawing and zoom/pan
    const composedGesture = useMemo((): SimultaneousGesture | PanGesture => {
      if (enableZoom) {
        // Combine drawing with the unified pan+zoom gesture
        return Gesture.Simultaneous(drawingGesture, combinedGesture);
      }
      return drawingGesture;
    }, [enableZoom, drawingGesture, combinedGesture]);

    // Create derived values for transformation with proper dependencies
    const transformMatrix = useDerivedValue((): SkMatrix => {
      if (!enableZoom || !scale || !translation) {
        return Skia.Matrix();
      }

      const matrix = Skia.Matrix();
      // Simple: translate then scale
      matrix.translate(translation.value.x, translation.value.y);
      matrix.scale(scale.value, scale.value);
      return matrix;
    });

    // Imperative handle
    useImperativeHandle(
      ref,
      (): PerfectCanvasRef => ({
        undo: (steps = 1): void => {
          for (let i = 0; i < steps; i++) {
            const previousState = historyManager.current.undo();
            if (previousState) {
              setPaths(previousState);
            } else {
              break;
            }
          }
          if (hapticsEnabled) {
            triggerSelection();
          }
        },
        redo: (steps = 1): void => {
          for (let i = 0; i < steps; i++) {
            const nextState = historyManager.current.redo();
            if (nextState) {
              setPaths(nextState);
            } else {
              break;
            }
          }
          if (hapticsEnabled) {
            triggerSelection();
          }
        },
        clear: (): void => {
          setPaths([]);
          historyManager.current.push([]);
          if (hapticsEnabled) {
            triggerNotification("success");
          }
        },
        reset: (): void => {
          setPaths([]);
          historyManager.current.clear();
          if (enableZoom) {
            resetZoom();
          }
        },
        resetZoom: (): void => {
          if (enableZoom && resetZoom) {
            resetZoom();
          }
        },
        setZoom: (zoom: number): void => {
          if (enableZoom && setScale) {
            setScale(zoom, true);
          }
        },
        getSnapshot: async (): Promise<SkImage | undefined> => {
          return canvasRef.current?.makeImageSnapshotAsync();
        },
        toBase64: async (
          format = ImageFormat.PNG,
          quality = 100
        ): Promise<string | undefined> => {
          const snapshot = await canvasRef.current?.makeImageSnapshotAsync();
          return snapshot?.encodeToBase64(format, quality);
        },
        toSvg: (
          width = 1000,
          height = 1000,
          bgColor: string = currentBackgroundColor
        ): string => {
          return createSvgFromPaths(paths, {
            width,
            height,
            backgroundColor: bgColor || currentBackgroundColor,
          });
        },
        getPaths: (): PathData[] => paths,
        setPaths: (newPaths: PathData[]): void => {
          setPaths(newPaths);
          historyManager.current.push(newPaths);
        },
        /* importSvg: (_svg: string): void => {
          // TODO: Implement SVG import
          console.warn("SVG import not yet implemented");
        }, */
        setStrokeColor: (color: string): void => {
          setCurrentStrokeColor(color);
          strokeColorShared.value = color;
        },
        setStrokeWidth: (width: number): void => {
          setCurrentStrokeWidth(width);
          strokeWidthShared.value = width;
        },
        setStrokeOpacity: (opacity: number): void => {
          setCurrentStrokeOpacity(opacity);
        },
        setBackgroundColor: (color: string): void => {
          setCurrentBackgroundColor(color);
        },
        setEnableHaptics: (enabled: boolean): void => {
          setHapticsEnabled(enabled);
        },
        setHapticStyle: (style: HapticStyle): void => {
          setCurrentHapticStyle(style);
        },
        getDrawingState: (): DrawingState => ({
          paths,
          currentPath: null,
          isDrawing: isDrawingRef.current,
          strokeColor: currentStrokeColor,
          strokeWidth: currentStrokeWidth,
          strokeOpacity: currentStrokeOpacity,
        }),
        isDrawing: (): boolean => isDrawingRef.current,
      }),
      [
        paths,
        currentStrokeColor,
        currentStrokeWidth,
        currentStrokeOpacity,
        currentBackgroundColor,
        hapticsEnabled,
        currentHapticStyle,
        enableZoom,
        triggerSelection,
        triggerNotification,
        resetZoom,
      ]
    );

    // Render paths with transformation
    const renderedPaths = useMemo((): React.ReactNode[] => {
      // We need to use a Group with matrix transformation
      return paths.map(
        (path): React.ReactNode => (
          <Path
            key={path.id}
            path={path.svgPath}
            color={path.color}
            style="fill"
            opacity={path.opacity || 1}
          />
        )
      );
    }, [paths]);

    return (
      <GestureHandlerRootView style={[styles.container, style]}>
        <GestureDetector gesture={composedGesture}>
          <View
            style={styles.canvasContainer}
            onLayout={(e): void => {
              const { width, height } = e.nativeEvent.layout;
              setCanvasSize({ width, height });
            }}
          >
            <Canvas
              ref={canvasRef}
              style={[
                styles.canvas,
                { backgroundColor: currentBackgroundColor },
              ]}
              {...(renderMode ? { mode: renderMode } : {})}
            >
              {/* Apply transformation to all content */}
              <Group matrix={transformMatrix}>
                {/* Rendered paths */}
                {renderedPaths}

                {/* Current drawing path */}
                <Path
                  path={currentPathShared}
                  color={strokeColorShared}
                  style="fill"
                  opacity={currentStrokeOpacity}
                />
              </Group>

              {/* Children (overlays, etc.) */}
              {children}
            </Canvas>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvasContainer: {
    flex: 1,
    overflow: "hidden",
  },
  canvas: {
    flex: 1,
  },
});

export const PerfectCanvas = memo(PerfectCanvasComponent);
export default PerfectCanvas;
