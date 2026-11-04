import { MASK_MAX_POINTS, MASK_MIN_POINTS, type EllipseMask, type Mask, type Point, type PolygonMask, type Surface } from '../model/mapping';

export type MaskKind = 'none' | 'ellipse' | 'polygon';
export type EllipseHandle = 'left' | 'right' | 'top' | 'bottom';

const MIN_SIZE = 1e-3;

export const initialMask = (kind: Exclude<MaskKind, 'none'>): Mask => {
  switch (kind) {
    case 'ellipse':
      return { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 };
    case 'polygon':
      return {
        type: 'polygon',
        points: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      };
  }
};

export const maskKind = (s: Surface): MaskKind => s.mask?.type ?? 'none';

export const moveMask = (m: Mask, dx: number, dy: number): Mask => {
  switch (m.type) {
    case 'ellipse':
      return { ...m, x: m.x + dx, y: m.y + dy };
    case 'polygon':
      return { ...m, points: m.points.map((p): Point => [p[0] + dx, p[1] + dy]) };
  }
};

export const moveVertex = (m: PolygonMask, i: number, to: Point): PolygonMask => ({ ...m, points: m.points.map((p, k) => (k === i ? to : p)) });

export const insertVertex = (m: PolygonMask, edge: number, at: Point): PolygonMask =>
  m.points.length >= MASK_MAX_POINTS ? m : { ...m, points: [...m.points.slice(0, edge + 1), at, ...m.points.slice(edge + 1)] };

export const removeVertex = (m: PolygonMask, i: number): PolygonMask => (m.points.length <= MASK_MIN_POINTS ? m : { ...m, points: m.points.filter((_, k) => k !== i) });

// Moves one edge to `at`, keeping the opposite edge fixed; returns [start, length].
const resizeAxis = (start: number, length: number, movesStart: boolean, at: number): readonly [number, number] => {
  if (!movesStart) return [start, Math.max(at - start, MIN_SIZE)];
  const end = start + length;
  const next = Math.min(at, end - MIN_SIZE);
  return [next, end - next];
};

export const resizeEllipse = (m: EllipseMask, handle: EllipseHandle, to: Point): EllipseMask => {
  switch (handle) {
    case 'left':
    case 'right': {
      const [x, width] = resizeAxis(m.x, m.width, handle === 'left', to[0]);
      return { ...m, x, width };
    }
    case 'top':
    case 'bottom': {
      const [y, height] = resizeAxis(m.y, m.height, handle === 'top', to[1]);
      return { ...m, y, height };
    }
  }
};
