import type { Face, Prop, Vec3 } from './spec';

export type HexPanel = Extract<Prop, { kind: 'hexPanel' }>;
type Corners = Face['corners'];

const WORLD_UP: Vec3 = [0, 1, 0];

const cross = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const scale = ([x, y, z]: Vec3, k: number): Vec3 => [x * k, y * k, z * k];
const add = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ax + bx, ay + by, az + bz];
const normalize = (v: Vec3): Vec3 => scale(v, 1 / Math.hypot(...v));

/** Bounding rectangle (2r x sqrt3 r) of the flat-top hexagon on the panel's front surface, TL, TR, BR, BL. */
export const hexPanelFace = ({ center, radius, depth, normal }: HexPanel): Corners => {
  const n = normalize(normal);
  const right = normalize(cross(WORLD_UP, n));
  const up = cross(n, right);
  const origin = add(center, scale(n, depth / 2));
  const [hw, hh] = [radius, (Math.sqrt(3) * radius) / 2];
  const at = (sx: number, sy: number): Vec3 => add(origin, add(scale(right, sx * hw), scale(up, sy * hh)));
  return [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
};
