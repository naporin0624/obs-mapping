import { describe, expect, it } from 'vitest';
import type { Mask } from '../model/mapping';
import { maskClipPath, maskContains, maskFromPx, maskOutline, maskToPx } from './mask';

const star: Mask = {
  type: 'polygon',
  points: [
    [0.5, 0],
    [0.79, 0.9],
    [0.02, 0.35],
    [0.98, 0.35],
    [0.21, 0.9],
  ],
};

describe('maskContains', () => {
  it('ellipse', () => {
    const e: Mask = { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 };
    expect(maskContains(e, [0.5, 0.5])).toBe(true);
    expect(maskContains(e, [0.02, 0.02])).toBe(false);
    expect(maskContains(e, [1.2, 0.5])).toBe(false);
    expect(maskContains({ type: 'ellipse', x: -0.25, y: 0, width: 1.5, height: 1 }, [0.02, 0.5])).toBe(true);
  });

  it('polygon is even-odd', () => {
    expect(maskContains(star, [0.5, 0.5])).toBe(false);
    expect(maskContains(star, [0.5, 0.1])).toBe(true);
  });
});

describe('maskOutline', () => {
  it('ellipse points lie on the ellipse', () => {
    const pts = maskOutline({ type: 'ellipse', x: 0, y: 0, width: 1, height: 1 }, 32);
    expect(pts).toHaveLength(32);
    for (const [x, y] of pts) expect(((x - 0.5) ** 2 + (y - 0.5) ** 2) / 0.25).toBeCloseTo(1, 9);
  });

  it('starts at angle 0 and has no closing point', () => {
    const pts = maskOutline({ type: 'ellipse', x: 0, y: 0, width: 2, height: 1 }, 4);
    expect(pts[0]).toEqual([2, 0.5]);
    expect(pts[1]?.[0]).toBeCloseTo(1, 9);
    expect(pts[1]?.[1]).toBeCloseTo(1, 9);
  });

  it('is empty for non-positive segment counts', () => {
    expect(maskOutline({ type: 'ellipse', x: 0, y: 0, width: 1, height: 1 }, 0)).toEqual([]);
  });

  it('polygon outline is its points', () => {
    expect(maskOutline(star, 32)).toEqual(star.type === 'polygon' ? star.points : []);
  });
});

describe('maskClipPath', () => {
  it('ellipse', () => {
    expect(maskClipPath({ type: 'ellipse', x: 0, y: 0, width: 1, height: 1 }, 1000, 1000)).toBe('ellipse(500px 500px at 500px 500px)');
  });

  it('polygon', () => {
    const css = maskClipPath(
      {
        type: 'polygon',
        points: [
          [0, 0],
          [1, 0],
          [0.5, 1],
        ],
      },
      1000,
      500,
    );
    expect(css).toBe('polygon(evenodd, 0px 0px, 1000px 0px, 500px 500px)');
  });
});

describe('maskToPx / maskFromPx', () => {
  const b = { x: 50, y: 50, width: 500, height: 250 };

  it('scales by width/height only and ignores x/y', () => {
    const px = maskToPx({ type: 'ellipse', x: 0, y: 0, width: 1, height: 1 }, b);
    expect(px).toEqual({ type: 'ellipse', x: 0, y: 0, width: 500, height: 250 });
    const poly = maskToPx({ type: 'polygon', points: [[0.5, 0.5]] }, b);
    expect(poly).toEqual({ type: 'polygon', points: [[250, 125]] });
  });

  it('round-trips', () => {
    for (const m of [{ type: 'ellipse', x: 0.1, y: 0.2, width: 0.5, height: 0.6 }, star] as const) {
      expect(maskFromPx(maskToPx(m, b), b)).toEqual(m);
    }
  });
});
