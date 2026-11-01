import type { Point, Surface } from '../model/mapping';
import { unitSquareToQuad } from './homography';

export type QuadWarning = 'degenerate' | 'not_convex' | null;

const EPS = 1e-9;

const cross = (o: Point, a: Point, b: Point): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const signedArea = (c: Surface['corners']): number =>
  c.reduce((acc, p, i) => {
    const q = c[(i + 1) % 4] as Point;
    return acc + (p[0] * q[1] - q[0] * p[1]);
  }, 0) / 2;

export const quadWarning = (c: Surface['corners']): QuadWarning => {
  if (unitSquareToQuad(c) === null || Math.abs(signedArea(c)) < EPS) return 'degenerate';
  const crosses = c.map((p, i) => cross(p, c[(i + 1) % 4] as Point, c[(i + 2) % 4] as Point));
  if (crosses.some((v) => Math.abs(v) < EPS)) return 'degenerate';
  const convex = crosses.every((v) => v > 0) || crosses.every((v) => v < 0);
  return convex ? null : 'not_convex';
};
