import type { Mask } from '../../../ui/src/model/mapping';

export type Vec3 = readonly [number, number, number];
export type Projector = { position: Vec3; target: Vec3; up: Vec3; fovY: number };
export type CropRect = { x: number; y: number; width: number; height: number };
export type Face = { id: string; name: string; corners: readonly [Vec3, Vec3, Vec3, Vec3]; crop: CropRect; mask?: Mask };
export type Prop =
  | { kind: 'box'; center: Vec3; size: Vec3; rotationY: number }
  | { kind: 'hexPanel'; center: Vec3; radius: number; depth: number; normal: Vec3 }
  | { kind: 'drum'; center: Vec3; radius: number; depth: number; normal: Vec3 };
export type DemoSlug = 'stairs' | 'hexagon' | 'drums' | 'cubes';
export type StepId = 'place' | 'fit' | 'shape' | 'done';
export type SceneSpec = { slug: DemoSlug; projector: Projector; props: readonly Prop[]; faces: readonly Face[]; steps: readonly StepId[] };

export const CANVAS = { width: 1920, height: 1080 } as const;
export const DEMO_SOURCE = 'Demo Camera';
