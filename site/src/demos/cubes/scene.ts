import type { Mask } from '../../../../ui/src/model/mapping';
import { faceAspect } from '../../scene/aspect-checks';
import { boxFace, faceRegion, type BoxSide } from '../../scene/box-face';
import { holeMask, roundHole, squareHole } from '../../scene/hole-mask';
import { sourceRegion } from '../../scene/source-region';
import type { CropRect, Face, Prop, SceneSpec, Vec3 } from '../../scene/spec';

type Box = Extract<Prop, { kind: 'box' }>;
type Corners = Face['corners'];
type Tier = { id: string; name: string; edge: number; holes: Partial<Record<'left' | 'right', Mask>> };

// Turned so the cubes' front vertical edges point at the projector; local +z then faces front-left.
const ROTATION = -Math.PI / 4;

const TIERS: readonly Tier[] = [
  { id: 'large', name: 'Large', edge: 0.9, holes: { left: holeMask(squareHole(0.5, 0.5, 0.2)), right: holeMask(roundHole(0.5, 0.5, 0.2)) } },
  { id: 'medium', name: 'Medium', edge: 0.55, holes: { right: holeMask(squareHole(0.5, 0.5, 0.2)) } },
  { id: 'small', name: 'Small', edge: 0.32, holes: {} },
];

const rotateY = ([x, y, z]: Vec3): Vec3 => [x * Math.cos(ROTATION) + z * Math.sin(ROTATION), y, -x * Math.sin(ROTATION) + z * Math.cos(ROTATION)];
const add = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ax + bx, ay + by, az + bz];

const cube = (center: Vec3, edge: number): Box => ({ kind: 'box', center, size: [edge, edge, edge], rotationY: ROTATION });

/** The next cube sits on the back corner of the top of `lower`, so it hides none of lower's lit faces. */
const stackOn = (lower: Box, edge: number): Box => {
  const [half, up] = [(lower.size[0] - edge) / 2, (lower.size[1] + edge) / 2];
  return cube(add(lower.center, rotateY([-half, up, -half])), edge);
};

const placeTier = (boxes: readonly Box[], { edge }: Tier): Box[] => {
  const lower = boxes.at(-1);
  return [...boxes, lower === undefined ? cube([0, edge / 2, 0], edge) : stackOn(lower, edge)];
};

const stack = TIERS.reduce<Box[]>(placeTier, []);

const face = (id: string, name: string, corners: Corners, mask?: Mask): Face => {
  const base: Face = { id, name, corners, crop: sourceRegion(faceAspect({ corners })) };
  return mask === undefined ? base : { ...base, mask };
};

const SIDES: readonly (readonly ['left' | 'right', BoxSide, string])[] = [
  ['left', 'front', 'Left'],
  ['right', 'right', 'Right'],
];

const sideFaces = (tier: Tier, box: Box): Face[] => SIDES.map(([key, side, label]) => face(`${tier.id}-${key}`, `${tier.name} ${label}`, boxFace(box, side), tier.holes[key]));

/** The L-shaped rest of a top that carries a cube at its back corner, as two strips. */
const topStrips = (tier: Tier, box: Box, upper: Box): Face[] => {
  const covered = upper.size[0] / box.size[0];
  const top = boxFace(box, 'top');
  const strip = (key: string, label: string, rect: CropRect): Face => face(`${tier.id}-top-${key}`, `${tier.name} Top ${label}`, faceRegion(top, rect));
  return [strip('left', 'Left', { x: 0, y: covered, width: covered, height: 1 - covered }), strip('right', 'Right', { x: covered, y: 0, width: 1 - covered, height: 1 })];
};

const topFaces = (tier: Tier, box: Box, upper: Box | undefined): Face[] => (upper === undefined ? [face(`${tier.id}-top`, `${tier.name} Top`, boxFace(box, 'top'))] : topStrips(tier, box, upper));

const tierFaces = (tier: Tier, i: number): Face[] => {
  const box = stack[i];
  if (box === undefined) throw new Error(`cubes: no box for ${tier.id}`);
  return [...sideFaces(tier, box), ...topFaces(tier, box, stack[i + 1])];
};

export const cubesScene: SceneSpec = {
  slug: 'cubes',
  projector: { position: [-0.5, 2.6, 3.35], target: [0, 0.75, 0], up: [0, 1, 0], fovY: 40 },
  props: stack,
  faces: TIERS.flatMap(tierFaces),
  steps: ['place', 'fit', 'shape', 'done'],
};
