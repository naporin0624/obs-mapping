import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { createProjectorCamera } from '../scene/projector';
import type { Projector } from '../scene/spec';
import { beamEnds, createProjectorBeam } from './projector-beam';

const PROJECTOR: Projector = { position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fovY: 40 };

const wallAt = (z: number): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).translate(0, 0, z), new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld();
  return mesh;
};

describe('beamEnds', () => {
  it('ends each frame corner where it hits the scene', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const ends = beamEnds(projector, [wallAt(0)], 10);
    expect(ends).toHaveLength(4);
    ends.forEach((end) => expect(end.z).toBeCloseTo(0, 6));
  });

  it('runs to the fallback distance when nothing is hit', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const ends = beamEnds(projector, [], 7);
    ends.forEach((end) => expect(end.distanceTo(projector.position)).toBeCloseTo(7, 6));
  });

  it('follows the 16:9 frame corners', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const [bl, br, tr, tl] = beamEnds(projector, [wallAt(0)], 10);
    const width = (br?.x ?? 0) - (bl?.x ?? 0);
    const height = (tl?.y ?? 0) - (bl?.y ?? 0);
    expect(width / height).toBeCloseTo(16 / 9, 6);
    expect(tr?.x).toBeCloseTo(br?.x ?? Number.NaN, 6);
  });
});

describe('createProjectorBeam', () => {
  it('draws one edge from the lens to each corner', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const beam = createProjectorBeam(projector, [wallAt(0)], 10);
    const lines = beam.group.children.find((c): c is THREE.LineSegments => c instanceof THREE.LineSegments);
    expect(lines?.geometry.getAttribute('position').count).toBe(8);
    expect(beam.group.name).toBe('projector-beam');
    beam.dispose();
  });
});
