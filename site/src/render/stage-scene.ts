import * as THREE from 'three';

import { createProjectorCamera } from '../scene/projector';
import type { SceneSpec } from '../scene/spec';
import { boundsOf, floorY } from './orbit-limits';
import { createProjectedMaterial } from './projected-material';
import { createProjectorBeam } from './projector-beam';
import { createProjectorBody } from './projector-body';
import { createProjectorDepth } from './projector-depth';
import { propGeometry } from './props';
import { PROP_BASE, ROOM_BASE } from './stage-palette';

export type StageScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render(): void;
  resize(width: number, height: number): void;
  /** Swaps what the projector shows: the in-page output for the sample, the camera texture for OBS. */
  setProjected(map: THREE.Texture): void;
  projected(): THREE.Texture;
  setBeamVisible(visible: boolean): void;
  dispose(): void;
};

const ROOM_SIZE = 20;
const WALL_GAP = 0.02;
const BEAM_REACH = 1.5;

// Floor under the props and a wall right behind them, so projection spill has somewhere to land.
const roomGeometries = (bounds: THREE.Box3): THREE.BufferGeometry[] => [
  new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE).rotateX(-Math.PI / 2).translate(0, floorY(bounds), 0),
  new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE).translate(0, ROOM_SIZE / 2 + floorY(bounds), bounds.min.z - WALL_GAP),
];

const aspectOf = (renderer: THREE.WebGLRenderer): number => {
  const { x, y } = renderer.getSize(new THREE.Vector2());
  return y > 0 ? x / y : 16 / 9;
};

// Only the projector body is lit this way; the stage receives projected light alone.
const bodyLights = (): THREE.Light[] => {
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(5, 6, 3);
  return [new THREE.HemisphereLight(0xc8d0ff, 0x303030, 2), key];
};

const beamReach = (spec: SceneSpec): number => new THREE.Vector3(...spec.projector.position).distanceTo(new THREE.Vector3(...spec.projector.target)) * BEAM_REACH;

type Surfaces = {
  meshes: THREE.Mesh[];
  bounds: THREE.Box3;
  depth: ReturnType<typeof createProjectorDepth>;
  setMap: (map: THREE.Texture) => void;
  dispose: () => void;
};

// Props and room, all lit only by the projector through one shared depth map.
const createSurfaces = (projector: THREE.PerspectiveCamera, spec: SceneSpec, output: THREE.Texture): Surfaces => {
  const props = spec.props.map(propGeometry);
  const bounds = boundsOf(props);
  const room = roomGeometries(bounds);
  const depth = createProjectorDepth(projector, [...props, ...room]);
  const propMaterial = createProjectedMaterial(projector, output, PROP_BASE, depth.texture);
  const roomMaterial = createProjectedMaterial(projector, output, ROOM_BASE, depth.texture);
  const materials = [propMaterial, roomMaterial];
  const meshes = [...props.map((g) => new THREE.Mesh(g, propMaterial)), ...room.map((g) => new THREE.Mesh(g, roomMaterial))];
  meshes.forEach((m) => m.updateMatrixWorld());
  return {
    meshes,
    bounds,
    depth,
    setMap: (map) => materials.forEach((m) => Object.assign(m.uniforms['map'] ?? {}, { value: map })),
    dispose() {
      [...props, ...room].forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      depth.dispose();
    },
  };
};

export const createStageScene = (renderer: THREE.WebGLRenderer, spec: SceneSpec, output: THREE.Texture): StageScene => {
  const projector = createProjectorCamera(spec.projector);
  const surfaces = createSurfaces(projector, spec, output);
  const body = createProjectorBody(projector, floorY(surfaces.bounds));
  const beam = createProjectorBeam(projector, surfaces.meshes, beamReach(spec));
  const scene = new THREE.Scene();
  scene.add(...surfaces.meshes, body.group, beam.group, ...bodyLights());
  const camera = new THREE.PerspectiveCamera(spec.projector.fovY, aspectOf(renderer), 0.01, 100);
  let projectedMap = output;
  // The stage is static, so the projector's depth is drawn once, on the first render.
  let depthReady = false;

  return {
    scene,
    camera,
    render() {
      if (!depthReady) surfaces.depth.render(renderer);
      depthReady = true;
      renderer.render(scene, camera);
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    setProjected(map) {
      projectedMap = map;
      surfaces.setMap(map);
    },
    projected: () => projectedMap,
    setBeamVisible: (visible) => void Object.assign(beam.group, { visible }),
    dispose() {
      surfaces.dispose();
      body.dispose();
      beam.dispose();
    },
  };
};
