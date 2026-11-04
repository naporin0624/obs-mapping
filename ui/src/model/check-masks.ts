import { MASK_MAX_POINTS, MASK_MIN_POINTS } from './mapping';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPositive = (v: unknown): v is number => isFinite(v) && v > 0;

const checkEllipse = (mask: Record<string, unknown>, path: string): string | null => {
  for (const key of ['x', 'y']) {
    if (!isFinite(mask[key])) return `${path}.${key}: expected a finite number`;
  }
  for (const key of ['width', 'height']) {
    if (!isPositive(mask[key])) return `${path}.${key}: expected a positive number`;
  }
  return null;
};

const isPoint = (p: unknown): boolean => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]);

const checkPolygon = (mask: Record<string, unknown>, path: string): string | null => {
  const { points } = mask;
  if (!Array.isArray(points) || points.length < MASK_MIN_POINTS || points.length > MASK_MAX_POINTS) {
    return `${path}.points: expected ${MASK_MIN_POINTS} to ${MASK_MAX_POINTS} points`;
  }
  const bad = points.findIndex((p) => !isPoint(p));
  return bad < 0 ? null : `${path}.points[${bad}]: expected [x, y]`;
};

const checkMask = (mask: unknown, path: string): string | null => {
  if (!isRecord(mask)) return `${path}: expected an object`;
  if (mask['type'] === 'ellipse') return checkEllipse(mask, path);
  if (mask['type'] === 'polygon') return checkPolygon(mask, path);
  return `${path}.type: expected "ellipse" or "polygon"`;
};

/** Reports the first invalid mask; surfaces without a mask are skipped. */
export const checkMasks = (surfaces: readonly unknown[]): string | null => {
  for (const [i, s] of surfaces.entries()) {
    if (!isRecord(s) || !('mask' in s)) continue;
    const problem = checkMask(s['mask'], `surfaces[${i}].mask`);
    if (problem !== null) return problem;
  }
  return null;
};
