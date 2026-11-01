import { describe, expect, it } from 'vitest';
import type { Surface } from '../model/mapping';
import { cssMatrix3d, unitSquareToQuad } from './homography';

// Parse matrix3d(...) (column-major) and apply to (x, y, 0, 1) with homogeneous divide.
const apply = (css: string, x: number, y: number): readonly [number, number] => {
  const m = css.slice('matrix3d('.length, -1).split(',').map(Number);
  const w = (m[3] as number) * x + (m[7] as number) * y + (m[15] as number);
  return [((m[0] as number) * x + (m[4] as number) * y + (m[12] as number)) / w, ((m[1] as number) * x + (m[5] as number) * y + (m[13] as number)) / w];
};

describe('cssMatrix3d', () => {
  const cases: readonly (readonly [string, Surface['corners']])[] = [
    [
      'axis-aligned',
      [
        [10, 20],
        [110, 20],
        [110, 70],
        [10, 70],
      ],
    ],
    [
      'perspective',
      [
        [30, 10],
        [200, 40],
        [180, 160],
        [0, 120],
      ],
    ],
    [
      'trapezoid',
      [
        [50, 0],
        [150, 0],
        [200, 100],
        [0, 100],
      ],
    ],
  ];
  it.each(cases)('maps source corners onto %s quad', (_n, c) => {
    const [w, h] = [640, 360];
    const css = cssMatrix3d(w, h, c);
    expect(css).not.toBeNull();
    const src: readonly (readonly [number, number])[] = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
    src.forEach(([sx, sy], i) => {
      const [x, y] = apply(css as string, sx, sy);
      expect(x).toBeCloseTo(c[i]![0], 6);
      expect(y).toBeCloseTo(c[i]![1], 6);
    });
  });
  it('returns null for degenerate quads', () => {
    expect(
      cssMatrix3d(100, 100, [
        [0, 0],
        [50, 0],
        [100, 0],
        [0, 100],
      ]),
    ).toBeNull();
    expect(
      cssMatrix3d(100, 100, [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).not.toBeNull();
    expect(
      unitSquareToQuad([
        [1, 1],
        [1, 1],
        [1, 1],
        [1, 1],
      ]),
    ).toBeNull();
  });
});
