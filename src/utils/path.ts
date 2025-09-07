import getStroke from "perfect-freehand";
import type { Point, StrokeOptions } from "../types";
import { getSvgPathFromStroke } from "./svg";

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function processPoints(points: Point[], options: StrokeOptions): string {
  if (points.length < 2) return "";

  const stroke = getStroke(points, {
    size: options.size || 8,
    thinning: options.thinning ?? 0.5,
    smoothing: options.smoothing ?? 0.5,
    streamline: options.streamline ?? 0.5,
    easing: options.easing || ((t): number => t),
    start: options.start || { taper: 0, cap: true },
    end: options.end || { taper: 0, cap: true },
  });

  return getSvgPathFromStroke(stroke);
}

export function simplifyPath(points: Point[], tolerance: number = 1): Point[] {
  if (points.length <= 2) return points;

  const simplified: Point[] = [points[0]];
  let prevPoint = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const distance = Math.sqrt(
      Math.pow(point[0] - prevPoint[0], 2) +
        Math.pow(point[1] - prevPoint[1], 2)
    );

    if (distance >= tolerance) {
      simplified.push(point);
      prevPoint = point;
    }
  }

  simplified.push(points[points.length - 1]);
  return simplified;
}

export function getPathBounds(points: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = points[0][0];
  let minY = points[0][1];
  let maxX = points[0][0];
  let maxY = points[0][1];

  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function interpolatePoints(p1: Point, p2: Point, t: number): Point {
  return [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t,
    p1[2] !== undefined && p2[2] !== undefined
      ? p1[2] + (p2[2] - p1[2]) * t
      : undefined,
  ].filter((v): boolean => v !== undefined) as Point;
}

export function getVelocity(p1: Point, p2: Point, deltaTime: number): number {
  "worklet";
  const distance = Math.sqrt(
    Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
  );
  return distance / Math.max(deltaTime, 1);
}

export function velocityToPressure(
  velocity: number,
  min: number = 0.2,
  max: number = 1
): number {
  "worklet";
  const normalized = Math.min(1, velocity / 100);
  return max - normalized * (max - min);
}
