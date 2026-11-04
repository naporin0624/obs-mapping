import { describe, expect, it } from 'vitest';
import type { Surface } from '../model/mapping';
import { applyH, cssMatrix3d, invert3, quadToUnit, unitSquareToQuad, unitToQuad, type Mat3 } from './homography';

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

describe('invert3 / applyH', () => {
  it('inverts a matrix so that m * inv = identity', () => {
    const m: Mat3 = [2, 0, 1, 0, 3, 2, 0.1, 0.2, 1];
    const inv = invert3(m) as Mat3;
    const p = applyH(m, [0.3, 0.7]) as readonly [number, number];
    const back = applyH(inv, p) as readonly [number, number];
    expect(back[0]).toBeCloseTo(0.3, 9);
    expect(back[1]).toBeCloseTo(0.7, 9);
  });

  it('returns null for a singular matrix', () => {
    expect(invert3([1, 2, 3, 2, 4, 6, 0, 0, 1])).toBeNull();
  });

  it('returns null when w <= 0', () => {
    expect(applyH([1, 0, 0, 0, 1, 0, 0, 0, -1], [1, 1])).toBeNull();
    expect(applyH([1, 0, 0, 0, 1, 0, 0, 0, 0], [1, 1])).toBeNull();
  });
});

describe('quadToUnit / unitToQuad', () => {
  const trapezoid: Surface['corners'] = [
    [30, 10],
    [90, 10],
    [110, 80],
    [10, 80],
  ];

  it('round-trips on a trapezoid', () => {
    for (const p of [
      [0, 0],
      [1, 1],
      [0.25, 0.75],
      [0.5, 0.5],
    ] as const) {
      const q = unitToQuad(trapezoid, p) as readonly [number, number];
      const u = quadToUnit(trapezoid, q) as readonly [number, number];
      expect(u[0]).toBeCloseTo(p[0], 9);
      expect(u[1]).toBeCloseTo(p[1], 9);
    }
  });

  it('maps unit corners to quad corners', () => {
    const q = unitToQuad(trapezoid, [1, 0]) as readonly [number, number];
    expect(q[0]).toBeCloseTo(90, 9);
    expect(q[1]).toBeCloseTo(10, 9);
  });

  it('returns null for a degenerate quad', () => {
    const flat: Surface['corners'] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    expect(quadToUnit(flat, [0.5, 0])).toBeNull();
    expect(unitToQuad(flat, [0.5, 0])).toBeNull();
  });
});
