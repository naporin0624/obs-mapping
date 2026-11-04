import * as THREE from 'three';

export type ProjectorBeam = { group: THREE.Group; dispose(): void };

// Bottom-left, bottom-right, top-right, top-left of the projected frame in NDC.
const CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const BEAM_COLOR = 0xffe9b0;

const cornerRay = (projector: THREE.PerspectiveCamera, [x, y]: readonly [number, number]): THREE.Ray => {
  const origin = projector.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(x, y, 0.5).unproject(projector).sub(origin).normalize();
  return new THREE.Ray(origin, direction);
};

const hitOrFar = (ray: THREE.Ray, targets: readonly THREE.Object3D[], fallback: number): THREE.Vector3 => {
  const raycaster = new THREE.Raycaster(ray.origin, ray.direction);
  const [hit] = raycaster.intersectObjects([...targets], false);
  return hit?.point ?? ray.at(fallback, new THREE.Vector3());
};

/** Where each frame corner meets the scene, or `fallback` metres out when it misses. */
export const beamEnds = (projector: THREE.PerspectiveCamera, targets: readonly THREE.Object3D[], fallback: number): THREE.Vector3[] =>
  CORNERS.map((corner) => hitOrFar(cornerRay(projector, corner), targets, fallback));

/** Frustum edges from the lens to where the frame lands, so the projected area reads at a glance. */
export const createProjectorBeam = (projector: THREE.PerspectiveCamera, targets: readonly THREE.Object3D[], fallback: number): ProjectorBeam => {
  const origin = projector.getWorldPosition(new THREE.Vector3());
  const ends = beamEnds(projector, targets, fallback);
  const geometry = new THREE.BufferGeometry().setFromPoints(ends.flatMap((end) => [origin, end]));
  const material = new THREE.LineBasicMaterial({ color: BEAM_COLOR, transparent: true, opacity: 0.5 });
  const group = new THREE.Group();
  group.name = 'projector-beam';
  group.add(new THREE.LineSegments(geometry, material));
  return {
    group,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
};
