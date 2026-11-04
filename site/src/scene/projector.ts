import { PerspectiveCamera, Vector3 } from 'three';
import type { Point } from '../../../ui/src/model/mapping';
import { CANVAS } from './spec';
import type { Projector, Vec3 } from './spec';

const ASPECT = 16 / 9;

export const createProjectorCamera = (p: Projector): PerspectiveCamera => {
  const camera = new PerspectiveCamera(p.fovY, ASPECT, 0.01, 100);
  camera.position.set(...p.position);
  camera.up.set(...p.up);
  camera.lookAt(...p.target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
};

export const projectToCanvas = (camera: PerspectiveCamera, v: Vec3): Point => {
  const ndc = new Vector3(...v).project(camera);
  return [((ndc.x + 1) / 2) * CANVAS.width, ((1 - ndc.y) / 2) * CANVAS.height];
};
