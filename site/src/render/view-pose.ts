import * as THREE from 'three';

import type { Projector, Vec3 } from '../scene/spec';

export type ViewPose = { position: Vec3; target: Vec3; up: Vec3 };

const ORBIT_DEGREES = 25;
const ORBIT_DOLLY = 1.3;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** orbit 0 is the projector pose; orbit 1 swings 25° around the target and backs off 1.3x to keep the stage in frame. */
export const orbitViewPose = (p: Projector, orbit: number): ViewPose => {
  const target = new THREE.Vector3(...p.target);
  const offset = new THREE.Vector3(...p.position)
    .sub(target)
    .applyAxisAngle(WORLD_UP, THREE.MathUtils.degToRad(ORBIT_DEGREES * orbit))
    .multiplyScalar(THREE.MathUtils.lerp(1, ORBIT_DOLLY, orbit));
  const [x, y, z] = offset.add(target).toArray();
  return { position: [x, y, z], target: p.target, up: p.up };
};
