import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { cubesScene } from '../demos/cubes/scene';
import { drumsScene } from '../demos/drums/scene';
import { hexagonScene } from '../demos/hexagon/scene';
import { stairsScene } from '../demos/stairs/scene';
import type { SceneSpec } from '../scene/spec';
import { floorY, keepAboveFloor, orbitLimits, sceneBounds, startPose } from './orbit-limits';
import { orbitViewPose } from './view-pose';

const scenes: readonly (readonly [string, SceneSpec])[] = [
  ['stairs', stairsScene],
  ['hexagon', hexagonScene],
  ['drums', drumsScene],
  ['cubes', cubesScene],
];

const polarOf = (offset: THREE.Vector3): number => new THREE.Spherical().setFromVector3(offset).phi;

describe.each(scenes)('orbitLimits for %s', (_name, spec) => {
  const bounds = sceneBounds(spec);
  const limits = orbitLimits(spec.projector, bounds);
  const target = new THREE.Vector3(...spec.projector.target);
  const start = new THREE.Vector3(...startPose(spec.projector, bounds).position);

  it('lets the initial view sit inside the distance range', () => {
    const distance = start.distanceTo(target);
    expect(limits.minDistance).toBeGreaterThan(0);
    expect(distance).toBeGreaterThan(limits.minDistance);
    expect(distance).toBeLessThan(limits.maxDistance);
  });

  it('allows the initial view angle', () => {
    expect(polarOf(start.clone().sub(target))).toBeLessThanOrEqual(limits.maxPolarAngle);
  });

  it('never tilts below the horizon by more than the floor allows at the farthest zoom, unless the start pose needs it', () => {
    const lowest = new THREE.Vector3().setFromSphericalCoords(limits.maxDistance, limits.maxPolarAngle, 0).add(target);
    const startPolar = polarOf(start.clone().sub(target));
    if (limits.maxPolarAngle > startPolar + 1e-9) expect(lowest.y).toBeGreaterThan(floorY(bounds));
  });
});

describe('startPose', () => {
  it('is the orbit-1 pose when that pose is above the floor', () => {
    const bounds = sceneBounds(drumsScene);
    expect(startPose(drumsScene.projector, bounds)).toEqual(orbitViewPose(drumsScene.projector, 1));
  });

  it('lifts the orbit-1 pose onto the floor when it would start below it', () => {
    const bounds = sceneBounds(stairsScene);
    const raw = orbitViewPose(stairsScene.projector, 1);
    const pose = startPose(stairsScene.projector, bounds);
    expect(raw.position[1]).toBeLessThan(floorY(bounds));
    expect(pose.position[1]).toBeGreaterThan(floorY(bounds));
    expect([pose.position[0], pose.position[2]]).toEqual([raw.position[0], raw.position[2]]);
  });
});

describe('keepAboveFloor', () => {
  it('raises a camera that went under the floor', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, -2, 3);
    keepAboveFloor(camera, 0);
    expect(camera.position.y).toBeGreaterThan(0);
    expect([camera.position.x, camera.position.z]).toEqual([1, 3]);
  });

  it('leaves a camera above the floor alone', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3);
    keepAboveFloor(camera, 0);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
  });
});

describe('sceneBounds', () => {
  it('wraps every face corner', () => {
    const bounds = sceneBounds(stairsScene).expandByScalar(1e-6);
    stairsScene.faces.flatMap((f) => f.corners).forEach((c) => expect(bounds.containsPoint(new THREE.Vector3(...c))).toBe(true));
  });
});
