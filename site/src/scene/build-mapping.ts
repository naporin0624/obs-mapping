import type { Mapping, Point, Surface } from '../../../ui/src/model/mapping';
import { createProjectorCamera, projectToCanvas } from './projector';
import { CANVAS, DEMO_SOURCE } from './spec';
import type { CropRect, Face, SceneSpec, Vec3 } from './spec';
import type { PerspectiveCamera } from 'three';

const round =
  (digits: number) =>
  (n: number): number => {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
  };
const round2 = round(2);
const round6 = round(6);

const roundPoint = ([x, y]: Point): Point => [round2(x), round2(y)];

const roundCrop = ({ x, y, width, height }: CropRect): CropRect => {
  const rx = round6(x);
  const ry = round6(y);
  return { x: rx, y: ry, width: Math.min(round6(width), round6(1 - rx)), height: Math.min(round6(height), round6(1 - ry)) };
};

const toSurface = (camera: PerspectiveCamera, face: Face): Surface => {
  const [a, b, c, d] = face.corners;
  const at = (v: Vec3): Point => roundPoint(projectToCanvas(camera, v));
  const surface: Surface = { id: face.id, name: face.name, type: 'quad', source: DEMO_SOURCE, crop: roundCrop(face.crop), corners: [at(a), at(b), at(c), at(d)], visible: true };
  return face.mask === undefined ? surface : { ...surface, mask: face.mask };
};

export const buildMapping = (spec: SceneSpec): Mapping => {
  const camera = createProjectorCamera(spec.projector);
  const surfaces = spec.faces.map((face) => toSurface(camera, face));
  return {
    version: 2,
    canvas: { width: CANVAS.width, height: CANVAS.height },
    grid: { size: 20 },
    surfaces,
    groups: [],
    layers: surfaces.map((s) => ({ surface: s.id })),
  };
};
