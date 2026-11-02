import type { Point, Surface } from '../model/mapping';
import { rectCorners, type Bounds } from '../geometry/rect';
import { snapPoint, snapToGrid, type GuideLine, type SnapHit } from '../geometry/snap';

export type SnapOptions = {
  grid: number | null;
  others: readonly Surface[];
  /** In canvas px (8 stage px converted by the caller). */
  threshold: number;
  /** false while Option/Alt is held. */
  enabled: boolean;
};

/** A snapped position plus the extended edge lines it snapped to (for the guide overlay). */
export type Snapped = { point: Point; guides: readonly GuideLine[] };

/** Corner and edge hits win; the softer kinds compete on adjustment size so the grid is not starved. */
const HIT_RANK: Record<Exclude<SnapHit['kind'], 'none'>, number> = { corner: 0, edge: 0, intersection: 1, line: 1, grid: 1 };

/** Effectively visible surfaces (see effectiveVisibleIds) that are not part of the current drag. */
export const snapTargets = (surfaces: readonly Surface[], movingIds: readonly string[], visibleIds: ReadonlySet<string>): Surface[] =>
  surfaces.filter((s) => visibleIds.has(s.id) && !movingIds.includes(s.id));

const round2 = (v: number): number => Math.round(v * 100) / 100 + 0;

const roundPoint = (p: Point): Point => [round2(p[0]), round2(p[1])];

/** Where a dragged corner lands: snapped to grid / other corners / other edges unless disabled. */
export const snapCornerHit = (p: Point, o: SnapOptions): Snapped => {
  if (!o.enabled) return { point: p, guides: [] };
  const hit = snapPoint(p, o);
  return { point: hit.point, guides: hit.guides ?? [] };
};

export const snapCorner = (p: Point, o: SnapOptions): Point => snapCornerHit(p, o).point;

type Adjustment = { rank: number; d: Point; guides: readonly GuideLine[] };

const adjustmentOf = (corner: Point, raw: Point, o: SnapOptions): Adjustment[] => {
  const moved: Point = [corner[0] + raw[0], corner[1] + raw[1]];
  const hit = snapPoint(moved, o);
  if (hit.kind === 'none') return [];
  return [{ rank: HIT_RANK[hit.kind], d: [hit.point[0] - moved[0], hit.point[1] - moved[1]], guides: hit.guides ?? [] }];
};

const stronger = (acc: Adjustment | null, a: Adjustment): Adjustment => (acc === null || a.rank < acc.rank || (a.rank === acc.rank && Math.hypot(...a.d) < Math.hypot(...acc.d)) ? a : acc);

/**
 * Total translation of a dragged surface. `raw` is the pointer offset since the drag started; the
 * offset is adjusted by the strongest snap among the four translated corners (corner/edge beat
 * the rest; within a rank the smallest adjustment wins). Guides are those of the winning corner.
 */
export const snapSurfaceHit = (startCorners: Surface['corners'], raw: Point, o: SnapOptions): Snapped => {
  if (!o.enabled) return { point: raw, guides: [] };
  const best = startCorners.flatMap((c) => adjustmentOf(c, raw, o)).reduce<Adjustment | null>(stronger, null);
  return best === null ? { point: raw, guides: [] } : { point: [raw[0] + best.d[0], raw[1] + best.d[1]], guides: best.guides };
};

export const snapSurfaceOffset = (startCorners: Surface['corners'], raw: Point, o: SnapOptions): Point => snapSurfaceHit(startCorners, raw, o).point;

export const roundedCornerHit = (p: Point, o: SnapOptions): Snapped => {
  const s = snapCornerHit(p, o);
  return { ...s, point: roundPoint(s.point) };
};
export const roundedOffsetHit = (corners: Surface['corners'], raw: Point, o: SnapOptions): Snapped => {
  const s = snapSurfaceHit(corners, raw, o);
  return { ...s, point: roundPoint(s.point) };
};

const isFree = (hit: Snapped, raw: Point): boolean => hit.guides.length === 0 && hit.point[0] === raw[0] && hit.point[1] === raw[1];

/** Frame corners snap like a surface; otherwise only the frame origin lands on the grid. */
export const roundedGroupOffsetHit = (frame: Bounds, raw: Point, o: SnapOptions): Snapped => {
  const hit = snapSurfaceHit(rectCorners(frame), raw, { ...o, grid: null });
  if (!o.enabled || o.grid === null || !isFree(hit, raw)) return { ...hit, point: roundPoint(hit.point) };
  const target = snapToGrid([frame.x + raw[0], frame.y + raw[1]], o.grid);
  return { point: roundPoint([target[0] - frame.x, target[1] - frame.y]), guides: [] };
};

export const roundedCorner = (p: Point, o: SnapOptions): Point => roundedCornerHit(p, o).point;
export const roundedOffset = (corners: Surface['corners'], raw: Point, o: SnapOptions): Point => roundedOffsetHit(corners, raw, o).point;
