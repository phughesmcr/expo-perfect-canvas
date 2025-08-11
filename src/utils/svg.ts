import type { PathData } from '../types';

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

export function createSvgFromPaths(
  paths: PathData[],
  options: {
    width?: number;
    height?: number;
    backgroundColor?: string;
  } = {}
): string {
  const { width = 1000, height = 1000, backgroundColor = 'white' } = options;

  const svgPaths = paths
    .map(
      (path) =>
        `<path d="${path.svgPath}" fill="${path.color}" opacity="${path.opacity || 1}" />`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${backgroundColor}" />
  ${svgPaths}
</svg>`;
}

export function parseSvgPath(svgPath: string): number[][] {
  const points: number[][] = [];
  const commands = svgPath.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g);
  
  if (!commands) return points;
  
  let currentX = 0;
  let currentY = 0;
  
  commands.forEach(cmd => {
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
    
    switch (type) {
      case 'M':
      case 'L':
        currentX = args[0];
        currentY = args[1];
        points.push([currentX, currentY]);
        break;
      case 'm':
      case 'l':
        currentX += args[0];
        currentY += args[1];
        points.push([currentX, currentY]);
        break;
    }
  });
  
  return points;
}