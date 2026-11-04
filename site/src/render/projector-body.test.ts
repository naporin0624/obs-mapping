import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { createProjectorCamera } from '../scene/projector';
import type { Projector } from '../scene/spec';
import { createProjectorBody } from './projector-body';

const PROJECTOR: Projector = { position: [1, 1.5, 4], target: [0, 1, 0], up: [0, 1, 0], fovY: 40 };

const worldBox = (object: THREE.Object3D): THREE.Box3 => {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
};

describe('createProjectorBody', () => {
  it('puts the lens on the projector position', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const body = createProjectorBody(projector, 0);
    const lens = body.group.getObjectByName('projector-lens');
    if (lens === undefined) throw new Error('expected a lens');
    body.group.updateMatrixWorld(true);
    const center = worldBox(lens).getCenter(new THREE.Vector3());
    expect(center.distanceTo(projector.position)).toBeLessThan(0.05);
    body.dispose();
  });

  it('stands on the floor', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const body = createProjectorBody(projector, -0.2);
    expect(worldBox(body.group).min.y).toBeCloseTo(-0.2, 3);
    body.dispose();
  });

  it('is named so the scene can find it', () => {
    const body = createProjectorBody(createProjectorCamera(PROJECTOR), 0);
    expect(body.group.name).toBe('projector-body');
    body.dispose();
  });
});
