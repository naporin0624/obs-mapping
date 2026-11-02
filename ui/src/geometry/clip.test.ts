import { describe, expect, it } from 'vitest';
import { clipLine } from './clip';

const canvas = { x: 0, y: 0, width: 1920, height: 1080 };

describe('clipLine', () => {
  it('clips a horizontal line to the full width', () => {
    expect(clipLine({ origin: [300, 40], dir: [1, 0] }, canvas)).toEqual([
      [0, 40],
      [1920, 40],
    ]);
  });
  it('clips a vertical line to the full height', () => {
    expect(clipLine({ origin: [500, 9], dir: [0, 1] }, canvas)).toEqual([
      [500, 0],
      [500, 1080],
    ]);
  });
  it('clips a 45 degree line at the rect edges', () => {
    const seg = clipLine({ origin: [100, 100], dir: [Math.SQRT1_2, Math.SQRT1_2] }, canvas);
    expect(seg?.[0][0]).toBeCloseTo(0);
    expect(seg?.[0][1]).toBeCloseTo(0);
    expect(seg?.[1][0]).toBeCloseTo(1080);
    expect(seg?.[1][1]).toBeCloseTo(1080);
  });
  it('returns null when the line misses the rect', () => {
    expect(clipLine({ origin: [0, -50], dir: [1, 0] }, canvas)).toBeNull();
    expect(clipLine({ origin: [2000, 0], dir: [0, 1] }, canvas)).toBeNull();
  });
  it('clips to a rect that starts at a negative origin', () => {
    expect(clipLine({ origin: [0, -50], dir: [1, 0] }, { x: -240, y: -240, width: 2400, height: 1560 })).toEqual([
      [-240, -50],
      [2160, -50],
    ]);
  });
  it('gives the same segment for opposite directions', () => {
    const xs = (seg: ReturnType<typeof clipLine>) => seg?.map((p) => p[0]).toSorted((a, b) => a - b);
    expect(xs(clipLine({ origin: [300, 40], dir: [-1, 0] }, canvas))).toEqual(xs(clipLine({ origin: [300, 40], dir: [1, 0] }, canvas)));
  });
});
