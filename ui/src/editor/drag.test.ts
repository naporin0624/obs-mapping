import { describe, expect, it } from 'vitest';
import type { Surface } from '../model/mapping';
import { roundedCorner, roundedOffset, snapCornerHit, snapCorner, snapSurfaceHit, snapSurfaceOffset, snapTargets, type SnapOptions } from './drag';

const surface = (id: string, corners: Surface['corners']): Surface => ({ id, name: id, type: 'quad', source: '', crop: { x: 0, y: 0, width: 1, height: 1 }, corners, visible: true });
const other = surface('b', [
  [500, 500],
  [600, 500],
  [600, 600],
  [500, 600],
]);
const opts = (patch: Partial<SnapOptions> = {}): SnapOptions => ({ grid: null, others: [other], threshold: 8, enabled: true, ...patch });

describe('snapCorner', () => {
  it('snaps to another surface corner within the threshold', () => {
    expect(snapCorner([503, 497], opts())).toEqual([500, 500]);
  });
  it('does not snap when disabled (Option held)', () => {
    expect(snapCorner([503, 497], opts({ enabled: false }))).toEqual([503, 497]);
  });
  it('snaps to the extension of another surface edge', () => {
    expect(snapCorner([1000, 503], opts())).toEqual([1000, 500]);
  });
  it('does not snap to extended lines when disabled (Option held)', () => {
    expect(snapCorner([1000, 503], opts({ enabled: false }))).toEqual([1000, 503]);
  });
  it('snaps to the grid when nothing else is near', () => {
    expect(snapCorner([104, 96], opts({ grid: 10 }))).toEqual([100, 100]);
  });
  it('rounds free positions to 2 decimals', () => {
    expect(roundedCorner([1.23456, 2.0004], opts({ others: [] }))).toEqual([1.23, 2]);
  });
});

describe('snapSurfaceOffset', () => {
  const start: Surface['corners'] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  it('adjusts the offset so the nearest corner lands on another corner', () => {
    // bottom-right corner moves to (497, 503); snaps to (500, 500)
    expect(snapSurfaceOffset(start, [397, 403], opts())).toEqual([400, 400]);
  });
  it('prefers corner/edge hits over grid hits', () => {
    expect(snapSurfaceOffset(start, [397, 403], opts({ grid: 50 }))).toEqual([400, 400]);
  });
  it('uses the raw offset when snapping is disabled or nothing is near', () => {
    expect(snapSurfaceOffset(start, [397, 403], opts({ enabled: false }))).toEqual([397, 403]);
    expect(snapSurfaceOffset(start, [200, 300], opts())).toEqual([200, 300]);
  });
  it('rounds the result', () => {
    expect(roundedOffset(start, [1.006, 2.999], opts({ others: [] }))).toEqual([1.01, 3]);
  });
  it('aligns the top edge of a moved surface with the extended top edge of another', () => {
    const wide: Surface['corners'] = [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ];
    expect(snapSurfaceOffset(wide, [1000, 497], opts())).toEqual([1000, 500]);
    expect(snapSurfaceOffset(wide, [1000, 497], opts({ enabled: false }))).toEqual([1000, 497]);
  });
  it('does not let a distant line starve a nearer grid snap on another corner', () => {
    const spread: Surface['corners'] = [
      [0, 0],
      [0, 43],
      [0, 0],
      [0, 0],
    ];
    // corner 0 lands 7px below the line y=500; corner 1 lands 1px from a grid point
    expect(snapSurfaceOffset(spread, [1001, 507], opts({ grid: 50 }))).toEqual([1000, 507]);
  });
});

describe('snapTargets', () => {
  const a = surface('a', [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ]);
  it('excludes the surfaces being dragged', () => {
    expect(snapTargets([a, other], ['a']).map((s) => s.id)).toEqual(['b']);
  });
  it('never snaps to the extended lines of the dragged surface itself', () => {
    expect(snapCorner([300, 3], opts({ others: snapTargets([a], ['a']) }))).toEqual([300, 3]);
    expect(snapCorner([300, 3], opts({ others: snapTargets([a], []) }))).toEqual([300, 0]);
  });
  it('excludes hidden surfaces', () => {
    expect(snapTargets([{ ...a, visible: false }, other], []).map((s) => s.id)).toEqual(['b']);
  });
});

describe('snap guides', () => {
  const top = { origin: [500, 500], dir: [1, 0] };
  it('a corner drag reports the guide of its line hit', () => {
    const r = snapCornerHit([1000, 503], opts());
    expect(r.point).toEqual([1000, 500]);
    expect(r.guides).toContainEqual(top);
  });
  it('reports no guides when snapping is disabled or the hit is a corner', () => {
    expect(snapCornerHit([1000, 503], opts({ enabled: false })).guides).toEqual([]);
    expect(snapCornerHit([503, 497], opts()).guides).toEqual([]);
  });
  it('a surface move reports the guides of the winning corner', () => {
    const wide: Surface['corners'] = [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ];
    const r = snapSurfaceHit(wide, [1000, 497], opts());
    expect(r.point).toEqual([1000, 500]);
    expect(r.guides).toContainEqual(top);
    expect(snapSurfaceHit(wide, [1000, 497], opts({ enabled: false })).guides).toEqual([]);
  });
});
