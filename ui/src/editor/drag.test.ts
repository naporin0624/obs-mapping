import { describe, expect, it } from 'vitest';
import type { Surface } from '../model/mapping';
import { roundedCorner, roundedOffset, snapCorner, snapSurfaceOffset, type SnapOptions } from './drag';

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
});
