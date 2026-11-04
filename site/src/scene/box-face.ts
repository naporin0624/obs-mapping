import type { CropRect, Face, Prop, Vec3 } from './spec';

type Box = Extract<Prop, { kind: 'box' }>;
type Corners = Face['corners'];

export const BOX_SIDES = ['front', 'right', 'back', 'left', 'top'] as const;
export type BoxSide = (typeof BOX_SIDES)[number];

const rotateY = ([x, y, z]: Vec3, angle: number): Vec3 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, y, -x * sin + z * cos];
};

const add = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ax + bx, ay + by, az + bz];
const scale = ([x, y, z]: Vec3, k: number): Vec3 => [x * k, y * k, z * k];
const sub = (a: Vec3, b: Vec3): Vec3 => add(a, scale(b, -1));

const LOCAL_NORMALS: Record<BoxSide, Vec3> = { front: [0, 0, 1], right: [1, 0, 0], back: [0, 0, -1], left: [-1, 0, 0], top: [0, 1, 0] };

/** Unit-cube corners of each side, TL, TR, BR, BL as seen from outside; the top face's top edge is at the back. */
const LOCAL_CORNERS: Record<BoxSide, Corners> = {
  front: [
    [-1, 1, 1],
    [1, 1, 1],
    [1, -1, 1],
    [-1, -1, 1],
  ],
  right: [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, -1],
    [1, -1, 1],
  ],
  back: [
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, -1],
    [1, -1, -1],
  ],
  left: [
    [-1, 1, -1],
    [-1, 1, 1],
    [-1, -1, 1],
    [-1, -1, -1],
  ],
  top: [
    [-1, 1, -1],
    [1, 1, -1],
    [1, 1, 1],
    [-1, 1, 1],
  ],
};

export const boxFace = ({ center, size: [sx, sy, sz], rotationY }: Box, side: BoxSide): Corners => {
  const toWorld = ([x, y, z]: Vec3): Vec3 => add(center, rotateY([(x * sx) / 2, (y * sy) / 2, (z * sz) / 2], rotationY));
  const [a, b, c, d] = LOCAL_CORNERS[side];
  return [toWorld(a), toWorld(b), toWorld(c), toWorld(d)];
};

export const boxFaceNormal = ({ rotationY }: Box, side: BoxSide): Vec3 => rotateY(LOCAL_NORMALS[side], rotationY);

/** Local +z face of the box (the one facing a projector at +z), TL, TR, BR, BL. */
export const boxFrontFace = (box: Box): Corners => boxFace(box, 'front');

/** The part of a planar rectangle given by `rect` in fractions of its width and height, TL origin. */
export const faceRegion = ([tl, tr, , bl]: Corners, { x, y, width, height }: CropRect): Corners => {
  const across = sub(tr, tl);
  const down = sub(bl, tl);
  const at = (u: number, v: number): Vec3 => add(tl, add(scale(across, u), scale(down, v)));
  return [at(x, y), at(x + width, y), at(x + width, y + height), at(x, y + height)];
};
