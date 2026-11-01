import { describe, expect, it } from 'vitest';
import type { Surface } from '../model/mapping';
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
  it('edge projection is clamped to the segment (beyond its end only the extended line applies)', () => {
    const hit = snapPoint([130, 4], { grid: null, others: [surf('e', 0, -50, 100, 50)], threshold: 8 });
    expect(hit).toMatchObject({ point: [130, 0], kind: 'line' });
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

describe('snap to extended edge lines', () => {
  const a = surf('a', 0, 0, 100, 100); // top edge y=0, x 0..100
  const c = surf('c', 500, 200, 100, 100); // left edge x=500, y 200..300
  const base = { grid: null, threshold: 8 };

  it('snaps to the extension of an edge far outside its segment', () => {
    expect(snapPoint([300, 3], { ...base, others: [a] })).toMatchObject({ point: [300, 0], kind: 'line' });
  });
  it('snaps to the intersection of two extended lines', () => {
    expect(snapPoint([497, 3], { ...base, others: [a, c] })).toMatchObject({ point: [500, 0], kind: 'intersection' });
  });
  it('snaps to where an extended line crosses a grid line', () => {
    expect(snapPoint([303, 3], { ...base, grid: 10, others: [a] })).toMatchObject({ point: [300, 0], kind: 'intersection' });
  });
  it('an extended line beats the plain grid snap, and the free axis lands on the grid', () => {
    expect(snapPoint([305, 3], { ...base, grid: 40, others: [a] })).toMatchObject({ point: [320, 0], kind: 'line' });
  });
  it('keeps the free axis on the grid even when the crossing is beyond the threshold', () => {
    expect(snapPoint([305, 7], { ...base, grid: 20, others: [a] })).toMatchObject({ point: [300, 0], kind: 'line' });
  });
  it('a corner beats extended lines', () => {
    expect(snapPoint([103, 3], { ...base, others: [a, surf('d', 98, 400, 10, 10)] })).toEqual({ point: [100, 0], kind: 'corner' });
  });
  it('an edge segment beats an intersection with an extended line', () => {
    const d = surf('d', 52, 200, 10, 10); // left edge x=52 would cross a's top at (52,0)
    expect(snapPoint([50, 4], { ...base, others: [a, d] })).toEqual({ point: [50, 0], kind: 'edge' });
  });
  it('has no extended lines when there are no other surfaces', () => {
    expect(snapPoint([300, 3], { ...base, others: [] })).toEqual({ point: [300, 3], kind: 'none' });
  });
  it('skips the intersection of near-parallel lines', () => {
    // slope -0.002 (about 0.11 degrees); the lines cross at (500,0), within threshold of p
    const tilted: Surface = {
      ...surf('t', 0, 0),
      corners: [
        [0, 1],
        [100, 0.8],
        [100, -500],
        [0, -500],
      ],
    };
    const hit = snapPoint([498, 3], { ...base, others: [a, tilted] });
    expect(hit.kind).toBe('line');
  });

  it('ignores crossings of two grid lines', () => {
    const diag: Surface = {
      ...surf('g', 0, 0),
      corners: [
        [1000, 1004],
        [1100, 1104],
        [1100, 2000],
        [1000, 2000],
      ],
    }; // line y = x + 4
    const hit = snapPoint([299, 309], { ...base, grid: 10, others: [diag] });
    expect(hit.kind).toBe('intersection');
    expect(hit.point[0]).toBeCloseTo(300);
    expect(hit.point[1]).toBeCloseTo(304);
  });
});

describe('snap to non-axis-aligned lines', () => {
  const diamond: Surface = {
    ...surf('d', 0, 0),
    corners: [
      [0, 0],
      [100, 100],
      [0, 200],
      [-100, 100],
    ],
  };
  const base = { grid: null, threshold: 8 };

  it('projects onto a 45 degree line', () => {
    const hit = snapPoint([300, 303], { ...base, others: [diamond] });
    expect(hit.kind).toBe('line');
    expect(hit.point[0]).toBeCloseTo(301.5);
    expect(hit.point[1]).toBeCloseTo(301.5);
  });
  it('intersects a diagonal with a horizontal line', () => {
    const hit = snapPoint([398, 402], { ...base, others: [diamond, surf('h', 500, 400, 100, 100)] });
    expect(hit.kind).toBe('intersection');
    expect(hit.point[0]).toBeCloseTo(400);
    expect(hit.point[1]).toBeCloseTo(400);
  });
  it('does not snap to a far crossing of two lines that are both near', () => {
    const tan = Math.tan((10 * Math.PI) / 180);
    const tilted: Surface = {
      ...surf('t', 0, 0),
      corners: [
        [500, 6 - 200 * tan],
        [600, 6 - 300 * tan],
        [600, -500],
        [500, -500],
      ],
    }; // passes about 6px from p at 10 degrees, crossing y=0 about 34px away
    const hit = snapPoint([300, 0], { ...base, others: [surf('a', 0, 0, 100, 100), tilted] });
    expect(hit).toMatchObject({ point: [300, 0], kind: 'line' });
  });
  it('ignores a near-zero-length edge instead of creating a phantom line', () => {
    const squashed: Surface = {
      ...surf('z', 0, 0),
      corners: [
        [0, 0],
        [1e-9, 1e-9],
        [100, 0],
        [0, -100],
      ],
    };
    expect(snapPoint([300, 303], { ...base, others: [squashed] })).toEqual({ point: [300, 303], kind: 'none' });
  });
});

describe('snap guides', () => {
  const a = surf('a', 0, 0, 100, 100);
  const c = surf('c', 500, 200, 100, 100);
  const base = { grid: null, threshold: 8 };

  it('reports the extended line of a line hit', () => {
    expect(snapPoint([300, 3], { ...base, others: [a] }).guides).toEqual([{ origin: [0, 0], dir: [1, 0] }]);
  });
  it('reports both lines of an intersection hit', () => {
    expect(snapPoint([497, 3], { ...base, others: [a, c] }).guides).toHaveLength(2);
  });
  it('reports only the surface line when the other line is a grid line', () => {
    const hit = snapPoint([303, 3], { ...base, grid: 10, others: [a] });
    expect(hit.kind).toBe('intersection');
    expect(hit.guides).toEqual([{ origin: [0, 0], dir: [1, 0] }]);
  });
  it('reports the surface line for a line hit slid onto the grid', () => {
    expect(snapPoint([305, 7], { ...base, grid: 20, others: [a] }).guides).toEqual([{ origin: [0, 0], dir: [1, 0] }]);
  });
  it('reports no guides for corner, edge and grid hits', () => {
    expect(snapPoint([103, 3], { ...base, others: [a] }).guides).toBeUndefined();
    expect(snapPoint([50, 4], { ...base, others: [a] }).guides).toBeUndefined();
    expect(snapPoint([53, 27], { ...base, grid: 10, others: [] }).guides).toBeUndefined();
  });
});
