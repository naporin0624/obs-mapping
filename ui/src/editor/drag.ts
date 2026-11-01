import type { Point, Surface } from '../model/mapping';
import { snapPoint } from '../geometry/snap';

export type SnapOptions = {
  grid: number | null;
  others: readonly Surface[];
  /** In canvas px (8 stage px converted by the caller). */
  threshold: number;
  /** false while Option/Alt is held. */
  enabled: boolean;
};

const round2 = (v: number): number => Math.round(v * 100) / 100 + 0;

const roundPoint = (p: Point): Point => [round2(p[0]), round2(p[1])];

/** Where a dragged corner lands: snapped to grid / other corners / other edges unless disabled. */
export const snapCorner = (p: Point, o: SnapOptions): Point => (o.enabled ? snapPoint(p, o).point : p);

/**
 * Total translation of a dragged surface. `raw` is the pointer offset since the drag started; the
 * offset is adjusted by the strongest snap among the four translated corners (corner and edge hits
 * beat grid hits; the smallest adjustment wins).
 */
export const snapSurfaceOffset = (startCorners: Surface['corners'], raw: Point, o: SnapOptions): Point => {
  if (!o.enabled) return raw;
  const adjustments = startCorners.flatMap((c) => {
    const moved: Point = [c[0] + raw[0], c[1] + raw[1]];
    const hit = snapPoint(moved, o);
    return hit.kind === 'none' ? [] : [{ rank: hit.kind === 'grid' ? 1 : 0, d: [hit.point[0] - moved[0], hit.point[1] - moved[1]] as const }];
  });
  const best = adjustments.reduce<(typeof adjustments)[number] | null>(
    (acc, a) => (acc === null || a.rank < acc.rank || (a.rank === acc.rank && Math.hypot(...a.d) < Math.hypot(...acc.d)) ? a : acc),
    null,
  );
  return best === null ? raw : [raw[0] + best.d[0], raw[1] + best.d[1]];
};

export const roundedCorner = (p: Point, o: SnapOptions): Point => roundPoint(snapCorner(p, o));
export const roundedOffset = (corners: Surface['corners'], raw: Point, o: SnapOptions): Point => roundPoint(snapSurfaceOffset(corners, raw, o));
