import { describe, expect, it } from 'vitest';
import { surf } from './fixtures';
import { snapPoint, snapToGrid } from './snap';

const others = [surf('o', 100, 100, 100, 100), surf('e', 0, -50, 100, 50)];
// 'e' has bottom edge (0,0)-(100,0).

describe('snap', () => {
  it('snapToGrid rounds to nearest grid point', () => {
    expect(snapToGrid([13, 27], 10)).toEqual([10, 30]);
  });
  it('corner snap wins over grid at the same distance', () => {
    const hit = snapPoint([103, 104], { grid: 10, others, threshold: 8 });
    expect(hit).toEqual({ point: [100, 100], kind: 'corner' });
  });
  it('edge snap projects onto the segment', () => {
    expect(snapPoint([50, 4], { grid: null, others, threshold: 8 })).toEqual({ point: [50, 0], kind: 'edge' });
  });
  it('edge projection is clamped to the segment (no snap beyond its end)', () => {
    const hit = snapPoint([130, 4], { grid: null, others: [surf('e', 0, -50, 100, 50)], threshold: 8 });
    expect(hit).toEqual({ point: [130, 4], kind: 'none' });
  });
  it('outside threshold with no grid is none and unchanged', () => {
    expect(snapPoint([50, 20], { grid: null, others, threshold: 8 })).toEqual({ point: [50, 20], kind: 'none' });
  });
  it('grid snap is unconditional when nothing is in range', () => {
    expect(snapPoint([53, 27], { grid: 10, others, threshold: 8 })).toEqual({ point: [50, 30], kind: 'grid' });
  });
  it('picks the nearest corner among several', () => {
    const hit = snapPoint([196, 199], { grid: null, others, threshold: 8 });
    expect(hit).toEqual({ point: [200, 200], kind: 'corner' });
  });
});
