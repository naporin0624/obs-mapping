import { describe, expect, it } from 'vitest';
import { hexPanelFace, type HexPanel } from './hex-panel-face';
import type { Vec3 } from './spec';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.hypot(...a);
const panel = (normal: Vec3): HexPanel => ({ kind: 'hexPanel', center: [1, 2, 0.1], radius: 0.5, depth: 0.2, normal });

describe('hexPanelFace', () => {
  it('is the 2r x sqrt3 r rectangle on the front surface of an untilted panel', () => {
    const [tl, tr, br, bl] = hexPanelFace(panel([0, 0, 1]));
    const expected: Vec3[] = [
      [0.5, 2 + Math.sqrt(3) / 4, 0.2],
      [1.5, 2 + Math.sqrt(3) / 4, 0.2],
      [1.5, 2 - Math.sqrt(3) / 4, 0.2],
      [0.5, 2 - Math.sqrt(3) / 4, 0.2],
    ];
    [tl, tr, br, bl].forEach((c, k) => c.forEach((v, axis) => expect(v).toBeCloseTo(expected[k]?.[axis] ?? NaN, 9)));
  });

  it('stays planar, perpendicular to the normal, with sides 2r and sqrt3 r when tilted', () => {
    const normal: Vec3 = [Math.sin(0.2) * Math.cos(0.15), Math.sin(0.15), Math.cos(0.2) * Math.cos(0.15)];
    const [tl, tr, br, bl] = hexPanelFace(panel(normal));
    expect(len(sub(tr, tl))).toBeCloseTo(1, 9);
    expect(len(sub(bl, tl))).toBeCloseTo(Math.sqrt(3) / 2, 9);
    expect(dot(sub(tr, tl), normal)).toBeCloseTo(0, 9);
    expect(dot(sub(bl, tl), normal)).toBeCloseTo(0, 9);
    sub(br, bl).forEach((v, axis) => expect(v).toBeCloseTo(sub(tr, tl)[axis] ?? NaN, 9));
    expect(tl[1]).toBeGreaterThan(bl[1]);
  });
});
