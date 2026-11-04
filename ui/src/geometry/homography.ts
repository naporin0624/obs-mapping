import type { Point, Surface } from '../model/mapping';

// Mirrors core/src/homography.cpp so plugin and UI agree on degenerate quads.
const EPS = 1e-12;

export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

const det3 = (m: Mat3): number => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);

// Heckbert's square-to-quad projective mapping. null when degenerate.
export const unitSquareToQuad = (c: Surface['corners']): Mat3 | null => {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = c;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < EPS) return null;

  const affine = Math.abs(dx3) < EPS && Math.abs(dy3) < EPS;
  const g = affine ? 0 : (dx3 * dy2 - dx2 * dy3) / den;
  const h = affine ? 0 : (dx1 * dy3 - dx3 * dy1) / den;

  const m: Mat3 = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  return Math.abs(det3(m)) < EPS ? null : m;
};

// Standard CSS matrix3d (column-major) for an element of srcW x srcH with transform-origin: 0 0.
export const cssMatrix3d = (srcW: number, srcH: number, c: Surface['corners']): string | null => {
  if (!(srcW > 0) || !(srcH > 0)) return null;
  const m = unitSquareToQuad(c);
  if (m === null) return null;
  // H = M * diag(1/w, 1/h, 1): element pixels -> unit square -> quad.
  const [a, b, tx, d, e, ty, g, h, i] = m;
  const cols = [a / srcW, d / srcW, 0, g / srcW, b / srcH, e / srcH, 0, h / srcH, 0, 0, 1, 0, tx, ty, 0, i];
  return `matrix3d(${cols.join(', ')})`;
};

export const invert3 = (m: Mat3): Mat3 | null => {
  const d = det3(m);
  if (Math.abs(d) < EPS) return null;
  const [a, b, c, e, f, g, h, i, j] = m;
  return [(f * j - g * i) / d, (c * i - b * j) / d, (b * g - c * f) / d, (g * h - e * j) / d, (a * j - c * h) / d, (c * e - a * g) / d, (e * i - f * h) / d, (b * h - a * i) / d, (a * f - b * e) / d];
};

// null when the point maps behind the projection plane (w <= 0).
export const applyH = (m: Mat3, p: Point): Point | null => {
  const w = m[6] * p[0] + m[7] * p[1] + m[8];
  if (!(w > 0)) return null;
  return [(m[0] * p[0] + m[1] * p[1] + m[2]) / w, (m[3] * p[0] + m[4] * p[1] + m[5]) / w];
};

export const unitToQuad = (corners: Surface['corners'], p: Point): Point | null => {
  const m = unitSquareToQuad(corners);
  return m === null ? null : applyH(m, p);
};

export const quadToUnit = (corners: Surface['corners'], p: Point): Point | null => {
  const m = unitSquareToQuad(corners);
  const inv = m === null ? null : invert3(m);
  return inv === null ? null : applyH(inv, p);
};
