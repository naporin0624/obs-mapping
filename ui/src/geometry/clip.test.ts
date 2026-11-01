import { describe, expect, it } from 'vitest';
import { clipLine } from './clip';

describe('clipLine', () => {
  it('clips a horizontal line to the full width', () => {
    expect(clipLine({ origin: [300, 40], dir: [1, 0] }, 1920, 1080)).toEqual([
      [0, 40],
      [1920, 40],
    ]);
  });
  it('clips a vertical line to the full height', () => {
    expect(clipLine({ origin: [500, 9], dir: [0, 1] }, 1920, 1080)).toEqual([
      [500, 0],
      [500, 1080],
    ]);
  });
  it('clips a 45 degree line at the rect edges', () => {
    const seg = clipLine({ origin: [100, 100], dir: [Math.SQRT1_2, Math.SQRT1_2] }, 1920, 1080);
    expect(seg?.[0][0]).toBeCloseTo(0);
    expect(seg?.[0][1]).toBeCloseTo(0);
    expect(seg?.[1][0]).toBeCloseTo(1080);
    expect(seg?.[1][1]).toBeCloseTo(1080);
  });
  it('returns null when the line misses the rect', () => {
    expect(clipLine({ origin: [0, -50], dir: [1, 0] }, 1920, 1080)).toBeNull();
    expect(clipLine({ origin: [2000, 0], dir: [0, 1] }, 1920, 1080)).toBeNull();
  });
  it('gives the same segment for opposite directions', () => {
    const xs = (seg: ReturnType<typeof clipLine>) => seg?.map((p) => p[0]).toSorted((a, b) => a - b);
    expect(xs(clipLine({ origin: [300, 40], dir: [-1, 0] }, 1920, 1080))).toEqual(xs(clipLine({ origin: [300, 40], dir: [1, 0] }, 1920, 1080)));
  });
});
