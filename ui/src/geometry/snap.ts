import type { Point, Surface } from '../model/mapping';

export type SnapHit = { point: Point; kind: 'corner' | 'edge' | 'grid' | 'none' };

type Candidate = { point: Point; dist: number };

// `+ 0` normalises -0 to 0.
export const snapToGrid = (p: Point, size: number): Point => [Math.round(p[0] / size) * size + 0, Math.round(p[1] / size) * size + 0];

const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

const projectOnSegment = (p: Point, a: Point, b: Point): Point => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return [a[0] + t * dx, a[1] + t * dy];
};

const nearest = (cands: readonly Candidate[], threshold: number): Candidate | null =>
  cands.reduce<Candidate | null>((best, c) => (c.dist <= threshold && (best === null || c.dist < best.dist) ? c : best), null);

export const snapPoint = (p: Point, opts: { grid: number | null; others: readonly Surface[]; threshold: number }): SnapHit => {
  const corners = opts.others.flatMap((s) => s.corners);
  const corner = nearest(
    corners.map((c) => ({ point: c, dist: distance(p, c) })),
    opts.threshold,
  );
  if (corner !== null) return { point: corner.point, kind: 'corner' };

  const edges = opts.others.flatMap((s) => s.corners.map((a, i) => projectOnSegment(p, a, s.corners[(i + 1) % 4] as Point)));
  const edge = nearest(
    edges.map((e) => ({ point: e, dist: distance(p, e) })),
    opts.threshold,
  );
  if (edge !== null) return { point: edge.point, kind: 'edge' };

  if (opts.grid !== null) return { point: snapToGrid(p, opts.grid), kind: 'grid' };
  return { point: p, kind: 'none' };
};
