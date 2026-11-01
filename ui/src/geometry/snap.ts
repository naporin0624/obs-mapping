import type { Point, Surface } from '../model/mapping';

/** An infinite line through `origin` along the unit vector `dir`. */
export type GuideLine = { origin: Point; dir: Point };

/** `guides` lists the surface edge lines an 'intersection' or 'line' hit snapped to. */
export type SnapHit = { point: Point; kind: 'corner' | 'edge' | 'intersection' | 'line' | 'grid' | 'none'; guides?: readonly GuideLine[] };

type SnapOptions = { grid: number | null; others: readonly Surface[]; threshold: number };

type Candidate = { point: Point; dist: number };

type Crossing = Candidate & { lines: readonly Line[] };

type Line = { origin: Point; dir: Point; isGrid: boolean };

/** Lines whose |sin(angle)| is below this (about 5 degrees) are treated as parallel. */
const PARALLEL_SIN_EPSILON = 0.087;

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

const nearest = <C extends Candidate>(cands: readonly C[], threshold: number): C | null =>
  cands.reduce<C | null>((best, c) => (c.dist <= threshold && (best === null || c.dist < best.dist) ? c : best), null);

/** Edges shorter than this give a numerically meaningless direction. */
const MIN_EDGE_LENGTH = 1e-6;

const nearLine = (p: Point, a: Point, b: Point, threshold: number): Line | null => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < MIN_EDGE_LENGTH || Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len > threshold) return null;
  return { origin: a, dir: [dx / len, dy / len], isGrid: false };
};

const distanceToLine = (p: Point, l: Line): number => Math.abs((p[0] - l.origin[0]) * l.dir[1] - (p[1] - l.origin[1]) * l.dir[0]);

const projectOnLine = (p: Point, l: Line): Point => {
  const t = (p[0] - l.origin[0]) * l.dir[0] + (p[1] - l.origin[1]) * l.dir[1];
  return [l.origin[0] + t * l.dir[0], l.origin[1] + t * l.dir[1]];
};

const intersect = (l1: Line, l2: Line): Point | null => {
  const cross = l1.dir[0] * l2.dir[1] - l1.dir[1] * l2.dir[0];
  if (Math.abs(cross) < PARALLEL_SIN_EPSILON) return null;
  const t = ((l2.origin[0] - l1.origin[0]) * l2.dir[1] - (l2.origin[1] - l1.origin[1]) * l2.dir[0]) / cross;
  return [l1.origin[0] + t * l1.dir[0], l1.origin[1] + t * l1.dir[1]];
};

const edgeLinesNear = (p: Point, others: readonly Surface[], threshold: number): Line[] =>
  others.flatMap((s) =>
    s.corners.flatMap((a, i) => {
      const line = nearLine(p, a, s.corners[(i + 1) % 4] as Point, threshold);
      return line === null ? [] : [line];
    }),
  );

const gridLines = (p: Point, size: number): Line[] => {
  const [gx, gy] = snapToGrid(p, size);
  return [
    { origin: [gx, 0], dir: [0, 1], isGrid: true },
    { origin: [0, gy], dir: [1, 0], isGrid: true },
  ];
};

/** Nearest crossing within the threshold among nearby lines; grid-grid pairs are ignored. */
const nearestIntersection = (p: Point, lines: readonly Line[], threshold: number): Crossing | null =>
  nearest(
    lines.flatMap((l1, i) =>
      lines.slice(i + 1).flatMap((l2) => {
        const x = l1.isGrid && l2.isGrid ? null : intersect(l1, l2);
        return x === null ? [] : [{ point: x, dist: distance(p, x), lines: [l1, l2] }];
      }),
    ),
    threshold,
  );

const guidesOf = (lines: readonly Line[]): GuideLine[] => lines.filter((l) => !l.isGrid).map((l) => ({ origin: l.origin, dir: l.dir }));

const closestLine = (p: Point, lines: readonly Line[]): Line => lines.reduce((best, l) => (distanceToLine(p, l) < distanceToLine(p, best) ? l : best));

/** Slides the point along the line to the nearest grid crossing, if one is within a grid cell. */
const alignAlongLine = (p: Point, line: Line, grid: readonly Line[], size: number): Point => {
  const onLine = projectOnLine(p, line);
  const crossings = grid.flatMap((g) => {
    const x = intersect(line, g);
    return x === null ? [] : [{ point: x, dist: distance(p, x) }];
  });
  return nearest(crossings, size)?.point ?? onLine;
};

const snapToExtendedLines = (p: Point, opts: SnapOptions): SnapHit | null => {
  const edgeLines = edgeLinesNear(p, opts.others, opts.threshold);
  if (edgeLines.length === 0) return null;
  const grid = opts.grid === null ? [] : gridLines(p, opts.grid);
  const crossing = nearestIntersection(p, [...edgeLines, ...grid], opts.threshold);
  if (crossing !== null) return { point: crossing.point, kind: 'intersection', guides: guidesOf(crossing.lines) };
  const line = closestLine(p, edgeLines);
  return { point: opts.grid === null ? projectOnLine(p, line) : alignAlongLine(p, line, grid, opts.grid), kind: 'line', guides: guidesOf([line]) };
};

export const snapPoint = (p: Point, opts: SnapOptions): SnapHit => {
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

  const extended = snapToExtendedLines(p, opts);
  if (extended !== null) return extended;

  if (opts.grid !== null) return { point: snapToGrid(p, opts.grid), kind: 'grid' };
  return { point: p, kind: 'none' };
};
