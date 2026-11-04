import { describe, expect, it } from 'vitest';
import { drumHeadCenter, drumHeadFace } from './drum-head-face';
import type { DrumProp } from './drum-head-face';
import type { Vec3 } from './spec';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.hypot(...a);
const drum = (normal: Vec3): DrumProp => ({ kind: 'drum', center: [1, 2, 0.1], radius: 0.5, depth: 0.2, normal });

describe('drumHeadCenter', () => {
  it('is the shell center moved half the depth along the normal', () => {
    expect(drumHeadCenter(drum([0, 0, 1]))).toEqual([1, 2, 0.2]);
  });
});

describe('drumHeadFace', () => {
  it('is the 2r square around the head circle on the front surface of an untilted drum', () => {
    const corners = drumHeadFace(drum([0, 0, 1]));
    const expected: Vec3[] = [
      [0.5, 2.5, 0.2],
      [1.5, 2.5, 0.2],
      [1.5, 1.5, 0.2],
      [0.5, 1.5, 0.2],
    ];
    corners.forEach((c, k) => c.forEach((v, axis) => expect(v).toBeCloseTo(expected[k]?.[axis] ?? NaN, 9)));
  });

  it('stays a planar 2r square centered on the head, perpendicular to the normal, when tilted', () => {
    const normal: Vec3 = [Math.sin(0.4) * Math.cos(0.5), Math.sin(0.5), Math.cos(0.4) * Math.cos(0.5)];
    const prop = drum(normal);
    const [tl, tr, br, bl] = drumHeadFace(prop);
    expect(len(sub(tr, tl))).toBeCloseTo(1, 9);
    expect(len(sub(bl, tl))).toBeCloseTo(1, 9);
    expect(dot(sub(tr, tl), normal)).toBeCloseTo(0, 9);
    expect(dot(sub(bl, tl), normal)).toBeCloseTo(0, 9);
    expect(dot(sub(tr, tl), sub(bl, tl))).toBeCloseTo(0, 9);
    sub(br, bl).forEach((v, axis) => expect(v).toBeCloseTo(sub(tr, tl)[axis] ?? NaN, 9));
    expect(tl[1]).toBeGreaterThan(bl[1]);
    const mid = [0, 1, 2].map((axis) => ((tl[axis] ?? NaN) + (br[axis] ?? NaN)) / 2);
    drumHeadCenter(prop).forEach((v, axis) => expect(mid[axis]).toBeCloseTo(v, 9));
  });
});
