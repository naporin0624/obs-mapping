import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { floorY, keepAboveFloor, orbitLimits, sceneBounds, startPose } from '../render/orbit-limits';
import type { SceneSpec } from '../scene/spec';

type MotionQuery = EventTarget & { readonly matches: boolean };

export type Orbit = { reset: () => void; update: () => boolean; dispose: () => void };

const placeAtStart = (controls: OrbitControls, spec: SceneSpec): void => {
  const pose = startPose(spec.projector, sceneBounds(spec));
  controls.object.position.set(...pose.position);
  controls.object.up.set(...pose.up);
  controls.target.set(...pose.target);
};

// An undamped update spends the glide's leftover deltas first, so reset() lands on the saved pose.
const resetExactly = (controls: OrbitControls): void => {
  const damping = controls.enableDamping;
  Object.assign(controls, { enableDamping: false });
  controls.update();
  controls.reset();
  Object.assign(controls, { enableDamping: damping });
};

/** Free view around the stage: limits from the scene, damping unless reduced motion, keys on `keyTarget`. */
export const createOrbit = (controls: OrbitControls, spec: SceneSpec, keyTarget: HTMLElement, motion: MotionQuery, onChange: () => void): Orbit => {
  const bounds = sceneBounds(spec);
  const floor = floorY(bounds);
  Object.assign(controls, orbitLimits(spec.projector, bounds));
  const syncDamping = (): void => void Object.assign(controls, { enableDamping: !motion.matches });
  const changed = (): void => {
    keepAboveFloor(controls.object, floor);
    onChange();
  };
  syncDamping();
  placeAtStart(controls, spec);
  controls.update();
  controls.saveState();
  controls.listenToKeyEvents(keyTarget);
  controls.addEventListener('change', changed);
  motion.addEventListener('change', syncDamping);
  return {
    reset: () => resetExactly(controls),
    update: () => controls.update(),
    dispose() {
      motion.removeEventListener('change', syncDamping);
      controls.removeEventListener('change', changed);
      controls.dispose();
    },
  };
};
