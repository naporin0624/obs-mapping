import * as THREE from 'three';

import type { Projector, SceneSpec } from '../scene/spec';
import { propGeometry } from './props';
import { orbitViewPose, type ViewPose } from './view-pose';

export type OrbitLimits = { minDistance: number; maxDistance: number; maxPolarAngle: number };

const NEAR_FACTOR = 0.6;
const FAR_FACTOR = 2.5;
const FLOOR_MARGIN = 0.05;

export const boundsOf = (geometries: readonly THREE.BufferGeometry[]): THREE.Box3 =>
  geometries.reduce((box, g) => {
    g.computeBoundingBox();
    return g.boundingBox === null ? box : box.union(g.boundingBox);
  }, new THREE.Box3());

export const sceneBounds = (spec: SceneSpec): THREE.Box3 => {
  const geometries = spec.props.map(propGeometry);
  const bounds = boundsOf(geometries);
  geometries.forEach((g) => g.dispose());
  return bounds;
};

export const floorY = (bounds: THREE.Box3): number => Math.min(0, bounds.min.y);

// The lowest camera sits at maxDistance, so tilting below the target is allowed only as far as the floor.
const polarLimit = (targetY: number, floor: number, maxDistance: number): number => {
  const headroom = Math.max(0, targetY - floor - FLOOR_MARGIN);
  return Math.acos(-Math.min(1, headroom / maxDistance));
};

const aboveFloor = (y: number, floor: number): number => Math.max(y, floor + FLOOR_MARGIN);

/** The orbit-1 pose, lifted onto the floor when a low projector would put it underneath. */
export const startPose = (projector: Projector, bounds: THREE.Box3): ViewPose => {
  const pose = orbitViewPose(projector, 1);
  const [x, y, z] = pose.position;
  return { ...pose, position: [x, aboveFloor(y, floorY(bounds)), z] };
};

export const keepAboveFloor = (camera: THREE.Camera, floor: number): void => {
  camera.position.setY(aboveFloor(camera.position.y, floor));
};

const polarOf = (position: THREE.Vector3, target: THREE.Vector3): number => new THREE.Spherical().setFromVector3(position.clone().sub(target)).phi;

/** Zoom and tilt limits around the stage; the start pose is always allowed, keepAboveFloor covers the rest. */
export const orbitLimits = (projector: Projector, bounds: THREE.Box3): OrbitLimits => {
  const target = new THREE.Vector3(...projector.target);
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  const start = new THREE.Vector3(...startPose(projector, bounds).position);
  const maxDistance = Math.max(start.distanceTo(target), radius) * FAR_FACTOR;
  const maxPolarAngle = Math.max(polarLimit(target.y, floorY(bounds), maxDistance), polarOf(start, target));
  return { minDistance: radius * NEAR_FACTOR, maxDistance, maxPolarAngle };
};
