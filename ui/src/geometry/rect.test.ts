import { describe, expect, it } from 'vitest';
import type { Surface } from '../model/mapping';
import { surf } from './fixtures';
import { boundsOf, rectCorners } from './rect';

describe('rect', () => {
  it('rectCorners returns TL, TR, BR, BL', () => {
    expect(rectCorners({ x: 10, y: 20, width: 100, height: 50 })).toEqual([
      [10, 20],
      [110, 20],
      [110, 70],
      [10, 70],
    ]);
  });
  it('boundsOf is the bounding box of the corners', () => {
    const s: Surface = {
      ...surf('a', 0, 0),
      corners: [
        [5, 10],
        [50, 0],
        [60, 40],
        [0, 30],
      ],
    };
    expect(boundsOf(s)).toEqual({ x: 0, y: 0, width: 60, height: 40 });
  });
});
