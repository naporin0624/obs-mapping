import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createOutputRenderer, type OutputRenderer } from '../../render/output-renderer';
import { faceRegion } from '../../scene/box-face';
import { createProjectorCamera, projectToCanvas } from '../../scene/projector';
import { CANVAS } from '../../scene/spec';
import type { Face } from '../../scene/spec';
import { mappings } from '../index';
import { cubesScene } from './scene';

type Rgba = readonly [number, number, number, number];

const WHITE: Rgba = [255, 255, 255, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

const whiteSource = (): THREE.DataTexture => {
  const tex = new THREE.DataTexture(new Uint8Array(16 * 4).fill(255), 4, 4, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
};

// Canvas pixel (y down) of a point given in fractions of the face, through the projector.
const canvasPixel = (face: Face, u: number, v: number): [number, number] => {
  const [point] = faceRegion(face.corners, { x: u, y: v, width: 0, height: 0 });
  const [x, y] = projectToCanvas(createProjectorCamera(cubesScene.projector), point);
  return [Math.floor(x), Math.floor(y)];
};

const holed = cubesScene.faces.filter((f) => f.mask !== undefined);

describe('cubes holes in the output', () => {
  let gl: THREE.WebGLRenderer;
  let out: OutputRenderer;
  let source: THREE.DataTexture;

  const pixel = (face: Face, u: number, v: number): Rgba => {
    const [x, y] = canvasPixel(face, u, v);
    const buf = new Uint8Array(4);
    gl.readRenderTargetPixels(out.target, x, CANVAS.height - 1 - y, 1, 1, buf);
    return [buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0, buf[3] ?? 0];
  };

  beforeEach(() => {
    gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    out = createOutputRenderer(gl);
    source = whiteSource();
    out.render({ mapping: mappings.cubes, maskAmount: 1, orbit: 0 }, source);
  });

  afterEach(() => {
    source.dispose();
    out.dispose();
    gl.dispose();
  });

  it.each(holed.map((f) => [f.id, f] as const))('%s: no light inside the hole, full light just outside it', (_id, face) => {
    expect(pixel(face, 0.5, 0.5)).toEqual(CLEAR);
    expect(pixel(face, 0.38, 0.5)).toEqual(CLEAR);
    for (const [u, v] of [
      [0.5, 0.25],
      [0.5, 0.75],
      [0.25, 0.5],
      [0.75, 0.5],
      [0.12, 0.5],
    ] as const)
      expect(pixel(face, u, v)).toEqual(WHITE);
  });

  it('lights an unmasked face all the way through its centre', () => {
    const plain = cubesScene.faces.find((f) => f.mask === undefined);
    if (plain === undefined) throw new Error('expected an unmasked face');
    expect(pixel(plain, 0.5, 0.5)).toEqual(WHITE);
  });
});
