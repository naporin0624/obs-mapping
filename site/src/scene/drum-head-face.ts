import type { Face, Prop, Vec3 } from './spec';

export type DrumProp = Extract<Prop, { kind: 'drum' }>;
type Corners = Face['corners'];

const WORLD_UP: Vec3 = [0, 1, 0];

const cross = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const scale = ([x, y, z]: Vec3, k: number): Vec3 => [x * k, y * k, z * k];
const add = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ax + bx, ay + by, az + bz];
const normalize = (v: Vec3): Vec3 => scale(v, 1 / Math.hypot(...v));

/** `center` is the middle of the shell; the head is the circle `depth / 2` along the normal. */
export const drumHeadCenter = ({ center, depth, normal }: DrumProp): Vec3 => add(center, scale(normalize(normal), depth / 2));

/** Square circumscribing the head circle, in the head plane, TL, TR, BR, BL. */
export const drumHeadFace = (drum: DrumProp): Corners => {
  const n = normalize(drum.normal);
  const right = normalize(cross(WORLD_UP, n));
  const up = cross(n, right);
  const origin = drumHeadCenter(drum);
  const at = (sx: number, sy: number): Vec3 => add(origin, add(scale(right, sx * drum.radius), scale(up, sy * drum.radius)));
  return [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
};
