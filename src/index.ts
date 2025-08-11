// Main export
export { PerfectCanvas as default } from './components/PerfectCanvas';
export { PerfectCanvas } from './components/PerfectCanvas';

// Type exports
export type {
  PerfectCanvasProps,
  PerfectCanvasRef,
  PathData,
  Point,
  DrawingState,
  StrokeOptions,
} from './types';

// Hook exports
export {
  useHaptics,
  useDrawingGesture,
  useZoomGesture,
} from './hooks';

// Utility exports
export {
  getSvgPathFromStroke,
  createSvgFromPaths,
  parseSvgPath,
  generateId,
  processPoints,
  simplifyPath,
  getPathBounds,
  interpolatePoints,
  getVelocity,
  velocityToPressure,
  HistoryManager,
} from './utils';