import { boxFrontFace } from '../../scene/box-face';
import { insideRegion, sourceRegion } from '../../scene/source-region';
import type { Face, Prop, SceneSpec } from '../../scene/spec';

export const RISERS = 5;
const WIDTH = 3;
const RISER_HEIGHT = 0.3;
const TREAD_DEPTH = 0.3;
const REGION = sourceRegion(WIDTH / (RISERS * RISER_HEIGHT));

export type Box = Extract<Prop, { kind: 'box' }>;

/** Index 0 is the top riser; each higher riser sits one tread farther from the projector. */
const riserBox = (index: number): Box => {
  const fromBottom = RISERS - 1 - index;
  return {
    kind: 'box',
    center: [0, fromBottom * RISER_HEIGHT + RISER_HEIGHT / 2, -fromBottom * TREAD_DEPTH - TREAD_DEPTH / 2],
    size: [WIDTH, RISER_HEIGHT, TREAD_DEPTH],
    rotationY: 0,
  };
};

const riserFace = (box: Box, index: number): Face => ({
  id: `riser-${String(index + 1)}`,
  name: `Riser ${String(index + 1)}`,
  corners: boxFrontFace(box),
  crop: insideRegion(REGION, { x: 0, y: index / RISERS, width: 1, height: 1 / RISERS }),
});

const boxes = Array.from({ length: RISERS }, (_, i) => riserBox(i));

export const stairsScene: SceneSpec = {
  slug: 'stairs',
  projector: { position: [0, 0.15, 2.9], target: [0, 0.75, -0.6], up: [0, 1, 0], fovY: 40 },
  props: boxes,
  faces: boxes.map(riserFace),
  steps: ['place', 'fit', 'done'],
};
