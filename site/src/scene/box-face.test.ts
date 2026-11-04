import { describe, expect, it } from 'vitest';
import { BOX_SIDES, boxFace, boxFaceNormal, boxFrontFace, faceRegion } from './box-face';
import type { Prop, Vec3 } from './spec';

type Box = Extract<Prop, { kind: 'box' }>;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const box: Box = { kind: 'box', center: [1, 2, 3], size: [2, 4, 6], rotationY: 0 };
const closeTo = (actual: readonly Vec3[], expected: readonly Vec3[]): void => actual.forEach((c, k) => c.forEach((v, axis) => expect(v).toBeCloseTo(expected[k]?.[axis] ?? NaN, 9)));

describe('boxFace', () => {
  it('puts the front face on +z, the same quad as boxFrontFace', () => {
    const expected: Vec3[] = [
      [0, 4, 6],
      [2, 4, 6],
      [2, 0, 6],
      [0, 0, 6],
    ];
    closeTo(boxFace(box, 'front'), expected);
    closeTo(boxFrontFace(box), expected);
  });

  it('puts the right face on +x, upright, TL nearest the front when seen from outside', () => {
    closeTo(boxFace(box, 'right'), [
      [2, 4, 6],
      [2, 4, 0],
      [2, 0, 0],
      [2, 0, 6],
    ]);
  });

  it('puts the top face on +y with its top edge at the back', () => {
    closeTo(boxFace(box, 'top'), [
      [0, 4, 0],
      [2, 4, 0],
      [2, 4, 6],
      [0, 4, 6],
    ]);
  });

  it.each(BOX_SIDES)('orders %s TL, TR, BR, BL clockwise as seen from outside the box', (side) => {
    const rotated: Box = { ...box, rotationY: 0.7 };
    const [tl, tr, , bl] = boxFace(rotated, side);
    const normal = boxFaceNormal(rotated, side);
    expect(dot(cross(sub(tr, tl), sub(bl, tl)), normal)).toBeLessThan(0);
    const center = boxFace(rotated, side).reduce<Vec3>((s, c) => [s[0] + c[0] / 4, s[1] + c[1] / 4, s[2] + c[2] / 4], [0, 0, 0]);
    expect(dot(sub(center, rotated.center), normal)).toBeGreaterThan(0);
  });

  it('rotates the normal with the box', () => {
    const turned: Box = { ...box, rotationY: Math.PI / 2 };
    boxFaceNormal(turned, 'front').forEach((v, axis) => expect(v).toBeCloseTo([1, 0, 0][axis] ?? NaN, 9));
    boxFaceNormal(turned, 'top').forEach((v, axis) => expect(v).toBeCloseTo([0, 1, 0][axis] ?? NaN, 9));
  });
});

describe('faceRegion', () => {
  it('cuts a sub-rectangle given in face fractions, TL origin', () => {
    const corners = boxFace(box, 'front');
    closeTo(faceRegion(corners, { x: 0.5, y: 0.25, width: 0.5, height: 0.75 }), [
      [1, 3, 6],
      [2, 3, 6],
      [2, 0, 6],
      [1, 0, 6],
    ]);
  });
});
