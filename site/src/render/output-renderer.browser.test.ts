import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { maskContains } from '../../../ui/src/geometry/mask';
import type { Mapping, Mask, Point, Surface } from '../../../ui/src/model/mapping';
import type { Frame } from '../story/stage-frame';
import { createOutputRenderer, type OutputRenderer } from './output-renderer';

type Rgba = readonly [number, number, number, number];

const W = 1920;
const H = 1080;
const WHITE: Rgba = [255, 255, 255, 255];
const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

const CENTER_QUAD: Surface['corners'] = [
  [480, 270],
  [1440, 270],
  [1440, 810],
  [480, 810],
];

// Source fixtures follow three's image convention: DataTexture row 0 is the bottom (v = 0).
// Nearest filtering keeps the red/green seam from blending at crop edges.
const sourceTexture = (pixel: (x: number, yFromTop: number) => Rgba): THREE.DataTexture => {
  const size = 4;
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let x = 0; x < size; x++) data.set(pixel(x, size - 1 - row), (row * size + x) * 4);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
};
const white = (): THREE.DataTexture => sourceTexture(() => WHITE);
const redGreen = (): THREE.DataTexture => sourceTexture((x) => (x < 2 ? RED : GREEN));
const blueTop = (): THREE.DataTexture => sourceTexture((_x, y) => (y < 2 ? BLUE : RED));

const surface = (id: string, patch: Partial<Surface> = {}): Surface => ({
  id,
  name: id,
  type: 'quad',
  source: 'Demo Camera',
  crop: { x: 0, y: 0, width: 1, height: 1 },
  corners: CENTER_QUAD,
  visible: true,
  ...patch,
});

const frameOf = (surfaces: readonly Surface[], maskAmount = 1, layers = surfaces.map((s) => ({ surface: s.id }))): Frame => {
  const mapping: Mapping = { version: 2, canvas: { width: W, height: H }, grid: { size: 20 }, surfaces, groups: [], layers };
  return { mapping, maskAmount, orbit: 0 };
};

// Convention: (x, y) are canvas px with y down (0 = top), like Mapping corners.
// The render target is y-up, so canvas row y lives at render-target row H - 1 - y.
const readCanvasPixel = (gl: THREE.WebGLRenderer, out: OutputRenderer, x: number, y: number): Rgba => {
  const buf = new Uint8Array(4);
  gl.readRenderTargetPixels(out.target, x, H - 1 - y, 1, 1, buf);
  return [buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0, buf[3] ?? 0];
};

const quadPoint = (u: number, v: number): [number, number] => [Math.floor(480 + u * 960), Math.floor(270 + v * 540)];

// Pentagram: 5 points on a circle joined by skipping one, so the centre is covered twice.
const star = (): Mask => ({
  type: 'polygon',
  points: [0, 2, 4, 1, 3].map((k): Point => {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / 5;
    return [0.5 + 0.45 * Math.cos(a), 0.5 + 0.45 * Math.sin(a)];
  }),
});

describe('createOutputRenderer', () => {
  let gl: THREE.WebGLRenderer;
  let out: OutputRenderer;

  beforeEach(() => {
    gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    out = createOutputRenderer(gl);
  });

  afterEach(() => {
    out.dispose();
    gl.dispose();
    gl.forceContextLoss();
  });

  it('renders into a 1920x1080 target', () => {
    expect([out.target.width, out.target.height]).toEqual([W, H]);
    expect(out.texture).toBe(out.target.texture);
  });

  it('draws the source inside the quad and leaves the rest transparent', () => {
    out.render(frameOf([surface('a')]), white());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(WHITE);
    expect(readCanvasPixel(gl, out, 100, 100)).toEqual(CLEAR);
  });

  it('places the quad with canvas y down', () => {
    const topLeft: Surface['corners'] = [
      [0, 0],
      [960, 0],
      [960, 540],
      [0, 540],
    ];
    out.render(frameOf([surface('a', { corners: topLeft })]), white());
    expect(readCanvasPixel(gl, out, 100, 100)).toEqual(WHITE);
    expect(readCanvasPixel(gl, out, 100, 1000)).toEqual(CLEAR);
  });

  it('cuts an ellipse mask when maskAmount is 1 and ignores it at 0', () => {
    const masked = surface('a', { mask: { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 } });
    out.render(frameOf([masked], 1), white());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(WHITE);
    expect(readCanvasPixel(gl, out, 490, 280)).toEqual(CLEAR);

    out.render(frameOf([masked], 0), white());
    expect(readCanvasPixel(gl, out, 490, 280)).toEqual(WHITE);
  });

  it('fills a self-intersecting polygon even-odd, agreeing with maskContains', () => {
    const mask = star();
    out.render(frameOf([surface('a', { mask })]), white());
    const samples: readonly Point[] = [
      [0.5, 0.5],
      [0.5, 0.15],
      [0.05, 0.05],
    ];
    const expected = samples.map((p) => (maskContains(mask, p) ? WHITE : CLEAR));
    expect(expected).toEqual([CLEAR, WHITE, CLEAR]);
    const actual = samples.map(([u, v]) => readCanvasPixel(gl, out, ...quadPoint(u, v)));
    expect(actual).toEqual(expected);
  });

  it('samples the cropped part of the source', () => {
    out.render(frameOf([surface('a', { crop: { x: 0.5, y: 0, width: 0.5, height: 1 } })]), redGreen());
    const points = [quadPoint(0.02, 0.02), quadPoint(0.5, 0.5), quadPoint(0.98, 0.98)];
    expect(points.map(([x, y]) => readCanvasPixel(gl, out, x, y))).toEqual([GREEN, GREEN, GREEN]);
  });

  it('measures crop y from the top of the source', () => {
    out.render(frameOf([surface('a', { crop: { x: 0, y: 0, width: 1, height: 0.5 } })]), blueTop());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(BLUE);
  });

  it('draws later layers on top', () => {
    const left = surface('left', { crop: { x: 0, y: 0, width: 0.5, height: 1 } });
    const right = surface('right', { crop: { x: 0.5, y: 0, width: 0.5, height: 1 } });
    out.render(frameOf([left, right]), redGreen());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(GREEN);

    out.render(frameOf([left, right], 1, [{ surface: 'right' }, { surface: 'left' }]), redGreen());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(RED);
  });

  it('skips hidden surfaces, hidden groups and degenerate quads', () => {
    const flat: Surface['corners'] = [
      [480, 270],
      [1440, 270],
      [1440, 270],
      [480, 270],
    ];
    out.render(frameOf([surface('a', { visible: false })]), white());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(CLEAR);

    out.render(frameOf([surface('a', { corners: flat })]), white());
    expect(readCanvasPixel(gl, out, 960, 270)).toEqual(CLEAR);

    const grouped = {
      ...frameOf([surface('a')]).mapping,
      groups: [{ id: 'g', name: 'g', visible: false, origin: [0, 0] as const, layout: { direction: 'row' as const, gap: 0, align: 'start' as const, padding: 0 } }],
      layers: [{ group: 'g', children: [{ surface: 'a' }] }],
    };
    out.render({ mapping: grouped, maskAmount: 1, orbit: 0 }, white());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(CLEAR);
  });

  it('clears the previous frame', () => {
    out.render(frameOf([surface('a')]), white());
    out.render(frameOf([]), white());
    expect(readCanvasPixel(gl, out, 960, 540)).toEqual(CLEAR);
  });
});
