import type { Point, PolygonMask } from '../../../ui/src/model/mapping';

const ROUND_SEGMENTS = 24;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Starts at the left edge's midpoint and goes clockwise, like roundHole. */
export const squareHole = (cx: number, cy: number, half: number): Point[] => [
  [cx - half, cy],
  [cx - half, cy - half],
  [cx + half, cy - half],
  [cx + half, cy + half],
  [cx - half, cy + half],
];

export const roundHole = (cx: number, cy: number, radius: number): Point[] =>
  Array.from({ length: ROUND_SEGMENTS }, (_, k): Point => {
    const a = Math.PI + (2 * Math.PI * k) / ROUND_SEGMENTS;
    return [round4(cx + radius * Math.cos(a)), round4(cy + radius * Math.sin(a))];
  });

// The plugin fills one point list even-odd. Both rings start on the hole's centre line,
// so the edges joining them are horizontal: they never count as crossings and leave no seam.
export const holeMask = (hole: readonly Point[]): PolygonMask => {
  const [start] = hole;
  if (start === undefined) throw new Error('holeMask: empty hole');
  const y = start[1];
  return { type: 'polygon', points: [[0, y], [0, 0], [1, 0], [1, 1], [0, 1], [0, y], ...hole, start] };
};
