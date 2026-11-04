import * as THREE from 'three';

import { CANVAS } from '../scene/spec';

export type ProjectorDepth = { texture: THREE.DepthTexture; render(renderer: THREE.WebGLRenderer): void; dispose(): void };

// One depth texel per output pixel, so silhouettes in both grids line up instead of beating.
export const PROJECTOR_DEPTH_SIZE = { width: CANVAS.width, height: CANVAS.height } as const;
const SIZE = PROJECTOR_DEPTH_SIZE;

/** Depth of world-space geometries as the projector sees them, so hidden surfaces get no light. */
export const createProjectorDepth = (projector: THREE.PerspectiveCamera, geometries: readonly THREE.BufferGeometry[]): ProjectorDepth => {
  const texture = new THREE.DepthTexture(SIZE.width, SIZE.height);
  const target = new THREE.WebGLRenderTarget(SIZE.width, SIZE.height, { depthTexture: texture });
  const material = new THREE.MeshBasicMaterial({ colorWrite: false });
  const scene = new THREE.Scene();
  scene.add(...geometries.map((g) => new THREE.Mesh(g, material)));

  const render = (renderer: THREE.WebGLRenderer): void => {
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, projector);
    renderer.setRenderTarget(previous);
  };

  const dispose = (): void => {
    material.dispose();
    texture.dispose();
    target.dispose();
  };

  return { texture, render, dispose };
};
