import type { Point, Surface } from '../model/mapping';

export type Bounds = { x: number; y: number; width: number; height: number };

export const boundsOf = (s: Surface): Bounds => {
  const xs = s.corners.map((p) => p[0]);
  const ys = s.corners.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

export const rectCorners = (b: Bounds): Surface['corners'] => {
  const tl: Point = [b.x, b.y];
  const tr: Point = [b.x + b.width, b.y];
  const br: Point = [b.x + b.width, b.y + b.height];
  const bl: Point = [b.x, b.y + b.height];
  return [tl, tr, br, bl];
};
