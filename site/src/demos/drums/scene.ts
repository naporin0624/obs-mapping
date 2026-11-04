import { drumHeadFace } from '../../scene/drum-head-face';
import type { DrumProp } from '../../scene/drum-head-face';
import { sourceRegion } from '../../scene/source-region';
import type { Face, SceneSpec, Vec3 } from '../../scene/spec';

const radians = (deg: number): number => (deg * Math.PI) / 180;

const normalOf = (yaw: number, pitch: number): Vec3 => [Math.sin(radians(yaw)) * Math.cos(radians(pitch)), Math.sin(radians(pitch)), Math.cos(radians(yaw)) * Math.cos(radians(pitch))];

type Head = { id: string; name: string; drum: DrumProp };

const head = (id: string, name: string, center: Vec3, radius: number, depth: number, yaw: number, pitch: number): Head => ({
  id,
  name,
  drum: { kind: 'drum', center, radius, depth, normal: normalOf(yaw, pitch) },
});

/** Shell centers in meters (y up, +z toward the projector); yaw and pitch in degrees. */
const heads: readonly Head[] = [
  head('kick', 'Kick', [0, 0.5, 0], 0.4, 0.5, 0, 6),
  head('snare', 'Snare', [-0.95, 0.8, 0.35], 0.2, 0.15, 25, 40),
  head('tom-1', 'Tom 1', [-0.4, 1.3, -0.1], 0.18, 0.28, 20, 40),
  head('tom-2', 'Tom 2', [0.4, 1.3, -0.1], 0.2, 0.3, -20, 40),
  head('floor-tom', 'Floor Tom', [1.05, 0.7, 0.2], 0.28, 0.4, -30, 45),
];

const headFace = ({ id, name, drum }: Head): Face => ({
  id,
  name,
  corners: drumHeadFace(drum),
  crop: sourceRegion(1),
  mask: { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 },
});

export const drumsScene: SceneSpec = {
  slug: 'drums',
  projector: { position: [0, 1.6, 3.4], target: [0, 0.85, 0], up: [0, 1, 0], fovY: 40 },
  props: heads.map((h) => h.drum),
  faces: heads.map(headFace),
  steps: ['place', 'fit', 'shape', 'done'],
};
