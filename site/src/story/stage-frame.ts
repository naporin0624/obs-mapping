import type { Mapping, Point, Surface } from '../../../ui/src/model/mapping';
import { CANVAS, type StepId } from '../scene/spec';

export type Frame = { mapping: Mapping; maskAmount: number; orbit: number };

type Corners = Surface['corners'];
type Crop = Surface['crop'];

const FULL_CORNERS: Corners = [
  [0, 0],
  [CANVAS.width, 0],
  [CANVAS.width, CANVAS.height],
  [0, CANVAS.height],
];
const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, k: number): number => a * (1 - k) + b * k;
const lerpPoint = (a: Point, b: Point, k: number): Point => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

const lerpCorners = (a: Corners, b: Corners, k: number): Corners => [lerpPoint(a[0], b[0], k), lerpPoint(a[1], b[1], k), lerpPoint(a[2], b[2], k), lerpPoint(a[3], b[3], k)];

const lerpCrop = (a: Crop, b: Crop, k: number): Crop => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  width: lerp(a.width, b.width, k),
  height: lerp(a.height, b.height, k),
});

const fitSurface = (s: Surface, k: number): Surface => ({
  ...s,
  corners: lerpCorners(FULL_CORNERS, s.corners, k),
  crop: lerpCrop(FULL_CROP, s.crop, k),
});

const withSurfaces = (m: Mapping, surfaces: readonly Surface[]): Mapping => ({ ...m, surfaces });

export const stageFrame = (target: Mapping, steps: readonly StepId[], index: number, t: number): Frame => {
  const i = Math.min(steps.length - 1, Math.max(0, index));
  const k = clamp01(t);
  const step = steps[i];

  switch (step) {
    case 'place':
      return {
        mapping: withSurfaces(
          target,
          target.surfaces.map((s) => fitSurface(s, 0)),
        ),
        maskAmount: 0,
        orbit: 0,
      };
    case 'fit':
      return {
        mapping: withSurfaces(
          target,
          target.surfaces.map((s) => fitSurface(s, k)),
        ),
        maskAmount: 0,
        orbit: 0,
      };
    case 'shape':
      return { mapping: target, maskAmount: k, orbit: 0 };
    case 'done':
    default:
      return { mapping: target, maskAmount: 1, orbit: k };
  }
};
