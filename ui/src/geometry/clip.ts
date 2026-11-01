import type { Point } from '../model/mapping';
import type { GuideLine } from './snap';

type Range = readonly [number, number] | null;

const PARALLEL = 1e-12;

/** Narrows the parameter range of o + t*d so the coordinate stays within [min, max]. */
const narrow = (range: Range, o: number, d: number, min: number, max: number): Range => {
  if (range === null) return null;
  if (Math.abs(d) < PARALLEL) return o < min || o > max ? null : range;
  const a = (min - o) / d;
  const b = (max - o) / d;
  const lo = Math.max(range[0], Math.min(a, b));
  const hi = Math.min(range[1], Math.max(a, b));
  return lo > hi ? null : [lo, hi];
};

/** Segment of the infinite line that lies inside the rect (0,0)-(width,height), or null if it misses. */
export const clipLine = (line: GuideLine, width: number, height: number): readonly [Point, Point] | null => {
  const { origin: o, dir: d } = line;
  const range = narrow(narrow([-Infinity, Infinity], o[0], d[0], 0, width), o[1], d[1], 0, height);
  if (range === null) return null;
  return [
    [o[0] + range[0] * d[0], o[1] + range[0] * d[1]],
    [o[0] + range[1] * d[0], o[1] + range[1] * d[1]],
  ];
};
