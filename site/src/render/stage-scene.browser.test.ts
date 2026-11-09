import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cubesScene } from '../demos/cubes/scene';
import { drumsScene } from '../demos/drums/scene';
import { hexagonScene } from '../demos/hexagon/scene';
import { stairsScene } from '../demos/stairs/scene';
import { createProjectorCamera, projectToCanvas } from '../scene/projector';
import { CANVAS, type Projector, type Vec3 } from '../scene/spec';
import { createProjectedMaterial } from './projected-material';
import { createProjectorDepth } from './projector-depth';
import { PROP_BASE, ROOM_BASE } from './stage-palette';
import { createStageScene, type StageScene } from './stage-scene';
import { orbitViewPose } from './view-pose';

type Rgba = readonly [number, number, number, number];
type Pixel = readonly [number, number];

const VIEW = { width: 480, height: 270 } as const;
const BASE = 0x203040;
const BASE_RGBA: Rgba = [0x20, 0x30, 0x40, 255];

// DataTexture row 0 is the bottom (v = 0); nearest filtering keeps texel values exact.
const dataTexture = (size: number, pixel: (x: number, row: number) => Rgba): THREE.DataTexture => {
  const data = new Uint8Array(size * size * 4);
  Array.from({ length: size * size }, (_, i) => data.set(pixel(i % size, Math.floor(i / size)), i * 4));
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
};
// Red channel encodes u, green encodes v, both in 1/256 steps.
const uvTexture = (): THREE.DataTexture => dataTexture(256, (x, row) => [x, row, 0, 255]);
const leftRedRightGreen = (): THREE.DataTexture => dataTexture(2, (x) => (x === 0 ? [255, 0, 0, 255] : [0, 255, 0, 255]));
const whiteTexture = (): THREE.DataTexture => dataTexture(2, () => [255, 255, 255, 255]);
const solidTexture = (rgba: Rgba): THREE.DataTexture => dataTexture(2, () => rgba);

const readPixel = (gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, [x, y]: Pixel): Rgba => {
  const buf = new Uint8Array(4);
  gl.readRenderTargetPixels(target, Math.floor(x), target.height - 1 - Math.floor(y), 1, 1, buf);
  return [buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0, buf[3] ?? 0];
};

// One readback for many samples: each readPixels waits for the GPU, which software GL makes slow.
const readTarget = (gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): ((at: Pixel) => Rgba) => {
  const buf = new Uint8Array(target.width * target.height * 4);
  gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, buf);
  return ([x, y]) => {
    const [col, row] = [Math.floor(x), target.height - 1 - Math.floor(y)];
    if (col < 0 || col >= target.width || row < 0 || row >= target.height) return [0, 0, 0, 0];
    const i = (row * target.width + col) * 4;
    return [buf[i] ?? 0, buf[i + 1] ?? 0, buf[i + 2] ?? 0, buf[i + 3] ?? 0];
  };
};

// Where a world point lands in a view of VIEW size, y down.
const viewPixel = (camera: THREE.Camera, v: Vec3): Pixel => {
  const ndc = new THREE.Vector3(...v).project(camera);
  return [((ndc.x + 1) / 2) * VIEW.width, ((1 - ndc.y) / 2) * VIEW.height];
};

const lookingCamera = (position: Vec3, target: Vec3): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(40, VIEW.width / VIEW.height, 0.01, 100);
  camera.position.set(...position);
  camera.lookAt(...target);
  camera.updateMatrixWorld();
  return camera;
};

const PROJECTOR: Projector = { position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fovY: 40 };

// World-space square whose front faces +z before the yaw around its own center.
type Slab = { center: Vec3; yaw?: number; size?: number };
const slabGeometry = ({ center, yaw = 0, size = 2 }: Slab): THREE.BufferGeometry => new THREE.PlaneGeometry(size, size).rotateY(yaw).translate(...center);

const near = (actual: Rgba, expected: Rgba, tolerance: number): boolean => actual.every((c, i) => Math.abs(c - (expected[i] ?? 0)) <= tolerance);

describe('createProjectedMaterial', () => {
  let gl: THREE.WebGLRenderer;
  let target: THREE.WebGLRenderTarget;

  beforeEach(() => {
    gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    target = new THREE.WebGLRenderTarget(VIEW.width, VIEW.height);
  });

  afterEach(() => {
    target.dispose();
    gl.dispose();
    gl.forceContextLoss();
  });

  const draw = (map: THREE.Texture, base: number, slabs: readonly Slab[], camera: THREE.Camera): void => {
    const projector = createProjectorCamera(PROJECTOR);
    const geometries = slabs.map(slabGeometry);
    const depth = createProjectorDepth(projector, geometries);
    const material = createProjectedMaterial(projector, map, base, depth.texture);
    const scene = new THREE.Scene();
    scene.add(...geometries.map((g) => new THREE.Mesh(g, material)));
    depth.render(gl);
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    depth.dispose();
    material.dispose();
  };

  it('samples the output at projectToCanvas / [1920, 1080] with y flipped', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const camera = lookingCamera([2.5, 1, 4], [0, 0, 0]);
    draw(uvTexture(), 0x000000, [{ center: [0, 0, 0], yaw: 0.3 }], camera);

    const points: readonly Vec3[] = [
      [-0.6, 0.5, 0.1],
      [0.5, -0.4, -0.08],
    ];
    points.forEach((local) => {
      const world = new THREE.Vector3(local[0], local[1], 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3).toArray();
      const [cx, cy] = projectToCanvas(projector, world);
      const expected: Rgba = [Math.floor((cx / CANVAS.width) * 256), Math.floor((1 - cy / CANVAS.height) * 256), 0, 255];
      expect(near(readPixel(gl, target, viewPixel(camera, world)), expected, 2)).toBe(true);
    });
  });

  it('adds no light to a face turned away from the projector', () => {
    const camera = lookingCamera([0, 0, -5], [0, 0, 0]);
    draw(whiteTexture(), BASE, [{ center: [0, 0, 0], yaw: Math.PI }], camera);
    expect(near(readPixel(gl, target, viewPixel(camera, [0, 0, 0])), BASE_RGBA, 1)).toBe(true);
  });

  it('adds no light outside the projector frustum', () => {
    const camera = lookingCamera([8, 0, 5], [8, 0, 0]);
    draw(whiteTexture(), BASE, [{ center: [8, 0, 0] }], camera);
    expect(near(readPixel(gl, target, viewPixel(camera, [8, 0, 0])), BASE_RGBA, 1)).toBe(true);
  });

  it('adds no light behind the projector', () => {
    const camera = lookingCamera([0, 0, 6], [0, 0, 8]);
    draw(whiteTexture(), BASE, [{ center: [0, 0, 8], yaw: Math.PI }], camera);
    expect(near(readPixel(gl, target, viewPixel(camera, [0, 0, 8])), BASE_RGBA, 1)).toBe(true);
  });

  it('lights a face toward the projector with the output colour on top of the base', () => {
    const camera = lookingCamera([0, 0, 5], [0, 0, 0]);
    draw(whiteTexture(), BASE, [{ center: [0, 0, 0] }], camera);
    expect(readPixel(gl, target, viewPixel(camera, [0, 0, 0]))).toEqual([255, 255, 255, 255]);
  });

  it('shows a lit colour exactly, without the base added on top', () => {
    const camera = lookingCamera([0, 0, 5], [0, 0, 0]);
    draw(solidTexture([0x20, 0x50, 0xc0, 255]), BASE, [{ center: [0, 0, 0] }], camera);
    expect(near(readPixel(gl, target, viewPixel(camera, [0, 0, 0])), [0x20, 0x50, 0xc0, 255], 3)).toBe(true);
  });

  it('keeps the base where the projected light is black', () => {
    const camera = lookingCamera([0, 0, 5], [0, 0, 0]);
    draw(solidTexture([0, 0, 0, 255]), BASE, [{ center: [0, 0, 0] }], camera);
    expect(near(readPixel(gl, target, viewPixel(camera, [0, 0, 0])), BASE_RGBA, 1)).toBe(true);
  });

  // Output drawn only inside the occluder's silhouette: the plane behind must not catch a fringe of it.
  it('leaks no light onto the surface just outside a nearer silhouette', () => {
    const projector = createProjectorCamera(PROJECTOR);
    const corners = (
      [
        [-0.3, 0.3],
        [0.3, 0.3],
        [0.3, -0.3],
        [-0.3, -0.3],
      ] as const
    ).map(([x, y]) => projectToCanvas(projector, [x, y, 1.5]));
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS.width;
    canvas.height = CANVAS.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('no 2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    corners.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
    // Like the output target and the camera texture: one level, linear, so only depth decides the edge.
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.NoColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    const camera = lookingCamera([3, 0, 5], [0, 0, 0]);
    draw(
      map,
      BASE,
      [
        { center: [0, 0, 0], size: 4 },
        { center: [0, 0, 1.5], size: 0.6 },
      ],
      camera,
    );
    const pixel = readTarget(gl, target);
    const lit = Array.from({ length: 80 }, (_, i) => -0.5 + i * 0.0125)
      .flatMap((y) => [-0.47, -0.45, -0.43, -0.41, 0.41, 0.43, 0.45, 0.47].map((x): Vec3 => [x, y, 0]))
      .filter((p) => !near(pixel(viewPixel(camera, p)), BASE_RGBA, 3));
    expect(lit).toEqual([]);
  });

  // A face seen almost edge-on by the projector catches almost none of its light, as a real one would.
  it('fades the light on faces the projector only grazes', () => {
    const grazing = Math.acos(0.05);
    const camera = lookingCamera([4, 0, 3], [0, 0, 0]);
    draw(whiteTexture(), BASE, [{ center: [0, 0, 0], yaw: grazing }], camera);
    expect(readPixel(gl, target, viewPixel(camera, [0, 0, 0]))[0]).toBeLessThan(0x20 + 64);
  });

  it('keeps full light on a face turned 60 degrees from the projector', () => {
    const camera = lookingCamera([4, 0, 3], [0, 0, 0]);
    draw(whiteTexture(), BASE, [{ center: [0, 0, 0], yaw: Math.PI / 3 }], camera);
    expect(readPixel(gl, target, viewPixel(camera, [0, 0, 0]))).toEqual([255, 255, 255, 255]);
  });

  // The occluder's shadow on the back plane spans |x| < 0.43; seen from the side it covers x near -1.3 instead.
  it('adds no light where a nearer surface blocks the projector', () => {
    const camera = lookingCamera([3, 0, 5], [0, 0, 0]);
    draw(
      whiteTexture(),
      BASE,
      [
        { center: [0, 0, 0], size: 4 },
        { center: [0, 0, 1.5], size: 0.6 },
      ],
      camera,
    );
    expect(near(readPixel(gl, target, viewPixel(camera, [0, 0, 0])), BASE_RGBA, 1)).toBe(true);
    expect(readPixel(gl, target, viewPixel(camera, [1, 0, 0]))).toEqual([255, 255, 255, 255]);
    expect(readPixel(gl, target, viewPixel(camera, [0, 0, 1.5]))).toEqual([255, 255, 255, 255]);
  });
});

describe('orbitViewPose', () => {
  const p = stairsScene.projector;
  const horizontal = (v: Vec3): THREE.Vector2 => new THREE.Vector2(v[0] - p.target[0], v[2] - p.target[2]);

  it('equals the projector pose at orbit 0', () => {
    const pose = orbitViewPose(p, 0);
    pose.position.forEach((c, i) => expect(c).toBeCloseTo(p.position[i] ?? Number.NaN, 9));
    expect(pose.target).toEqual(p.target);
    expect(pose.up).toEqual(p.up);
  });

  it('swings 25 degrees around the target at orbit 1', () => {
    const pose = orbitViewPose(p, 1);
    const from = horizontal(p.position);
    const to = horizontal(pose.position);
    const angle = Math.acos(from.dot(to) / (from.length() * to.length()));
    expect((angle * 180) / Math.PI).toBeCloseTo(25, 6);
    expect(to.length()).toBeCloseTo(from.length() * 1.3, 9);
    expect(pose.position[1] - p.target[1]).toBeCloseTo((p.position[1] - p.target[1]) * 1.3, 9);
  });
});

describe('orbitViewPose framing', () => {
  it('dollies by lerp(1, 1.3, orbit): 1.15 at orbit 0.5', () => {
    const p = stairsScene.projector;
    const offset = (orbit: number): THREE.Vector3 => new THREE.Vector3(...orbitViewPose(p, orbit).position).sub(new THREE.Vector3(...p.target));
    expect(offset(0.5).length()).toBeCloseTo(offset(0).length() * 1.15, 9);
  });

  it('backs the view off as orbit grows', () => {
    const p = stairsScene.projector;
    const distance = (orbit: number): number => new THREE.Vector3(...orbitViewPose(p, orbit).position).distanceTo(new THREE.Vector3(...p.target));
    expect(distance(1)).toBeGreaterThan(distance(0) * 1.2);
  });

  it.each([
    ['stairs', stairsScene],
    ['hexagon', hexagonScene],
    ['drums', drumsScene],
    ['cubes', cubesScene],
  ])('keeps every %s face corner inside a 16:9 view at orbit 1', (_name, scene) => {
    const pose = orbitViewPose(scene.projector, 1);
    const camera = new THREE.PerspectiveCamera(scene.projector.fovY, 16 / 9, 0.01, 100);
    camera.position.set(...pose.position);
    camera.up.set(...pose.up);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    scene.faces
      .flatMap((f) => f.corners)
      .forEach((c) => {
        const ndc = new THREE.Vector3(...c).project(camera);
        expect(new THREE.Vector3(...c).applyMatrix4(camera.matrixWorldInverse).z).toBeLessThan(0);
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.98);
      });
  });
});

describe('createStageScene', () => {
  let gl: THREE.WebGLRenderer;
  let target: THREE.WebGLRenderTarget;

  beforeEach(() => {
    gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    target = new THREE.WebGLRenderTarget(VIEW.width, VIEW.height);
  });

  afterEach(() => {
    target.dispose();
    gl.dispose();
    gl.forceContextLoss();
  });

  // The projector body sits on the projector pose, so views from there hide it.
  const viewFrom = (stage: StageScene, orbit: number): void => {
    const pose = orbitViewPose(stairsScene.projector, orbit);
    stage.camera.position.set(...pose.position);
    stage.camera.up.set(...pose.up);
    stage.camera.lookAt(...pose.target);
    const body = stage.scene.getObjectByName('projector-body');
    if (body !== undefined) body.visible = orbit !== 0;
  };

  const drawInto = (stage: StageScene, into: THREE.WebGLRenderTarget): void => {
    gl.setRenderTarget(into);
    stage.render();
    gl.setRenderTarget(null);
  };

  const renderStage = (orbit: number, size: { width: number; height: number }, map: THREE.Texture = leftRedRightGreen()): void => {
    const stage = createStageScene(gl, stairsScene, map);
    stage.resize(size.width, size.height);
    viewFrom(stage, orbit);
    drawInto(stage, target);
    stage.dispose();
  };

  const facePoint = (corners: readonly [Vec3, Vec3, Vec3, Vec3], u: number, v: number): Vec3 => {
    const [tl, tr, br, bl] = corners.map((c) => new THREE.Vector3(...c));
    if (tl === undefined || tr === undefined || br === undefined || bl === undefined) throw new Error('expected 4 corners');
    const top = tl.clone().lerp(tr, u);
    const bottom = bl.clone().lerp(br, u);
    return top.lerp(bottom, v).toArray();
  };

  const isRed = ([r, g]: Rgba): boolean => r > 200 && g < 100;
  const isGreen = ([r, g]: Rgba): boolean => g > 200 && r < 100;

  it('from the projector pose shows red just inside the left end and green just inside the right end of every riser', () => {
    renderStage(0, VIEW);
    const camera = createProjectorCamera(stairsScene.projector);
    stairsScene.faces.forEach((face) => {
      expect(isRed(readPixel(gl, target, viewPixel(camera, facePoint(face.corners, 0.04, 0.5))))).toBe(true);
      expect(isGreen(readPixel(gl, target, viewPixel(camera, facePoint(face.corners, 0.96, 0.5))))).toBe(true);
    });
  });

  // At aspect 3 the 16:9 projector frustum spans only the middle 480 of 810 px (x 165..645).
  it('keeps the aspect from resize, so a wide view shows unlit sides', () => {
    const wide = { width: 810, height: 270 };
    const wideTarget = new THREE.WebGLRenderTarget(wide.width, wide.height);
    const stage = createStageScene(gl, stairsScene, leftRedRightGreen());
    stage.resize(wide.width, wide.height);
    viewFrom(stage, 0);
    drawInto(stage, wideTarget);
    const at = (x: number): Rgba => readPixel(gl, wideTarget, [x, wide.height / 2]);
    expect([isRed(at(140)), isRed(at(190)), isGreen(at(620)), isGreen(at(670))]).toEqual([false, true, true, false]);
    stage.dispose();
    wideTarget.dispose();
  });

  it('draws from wherever its camera is placed', () => {
    renderStage(1, VIEW);
    const pose = orbitViewPose(stairsScene.projector, 1);
    const camera = lookingCamera(pose.position, pose.target);
    const face = stairsScene.faces[0];
    if (face === undefined) throw new Error('expected a riser');
    expect(isRed(readPixel(gl, target, viewPixel(camera, facePoint(face.corners, 0.2, 0.5))))).toBe(true);
    expect(isGreen(readPixel(gl, target, viewPixel(camera, facePoint(face.corners, 0.8, 0.5))))).toBe(true);
  });

  it('projects a swapped map on the next render', () => {
    const stage = createStageScene(gl, stairsScene, leftRedRightGreen());
    const white = whiteTexture();
    stage.resize(VIEW.width, VIEW.height);
    viewFrom(stage, 0);
    stage.setProjected(white);
    drawInto(stage, target);
    expect(stage.projected()).toBe(white);
    const face = stairsScene.faces[0];
    if (face === undefined) throw new Error('expected a riser');
    const at = viewPixel(createProjectorCamera(stairsScene.projector), facePoint(face.corners, 0.04, 0.5));
    expect(readPixel(gl, target, at)).toEqual([255, 255, 255, 255]);
    stage.dispose();
  });

  // A camera frame arrives as a y-down canvas; CanvasTexture's flipY must keep it upright on the stage.
  it('projects a canvas texture upright: its top half lands on the top riser', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('no 2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1920, 540);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    const stage = createStageScene(gl, stairsScene, leftRedRightGreen());
    stage.resize(VIEW.width, VIEW.height);
    viewFrom(stage, 0);
    stage.setProjected(texture);
    drawInto(stage, target);
    const camera = createProjectorCamera(stairsScene.projector);
    const [top] = stairsScene.faces;
    const bottom = stairsScene.faces.at(-1);
    if (top === undefined || bottom === undefined) throw new Error('expected risers');
    expect(readPixel(gl, target, viewPixel(camera, facePoint(top.corners, 0.5, 0.5)))).toEqual([255, 255, 255, 255]);
    expect(readPixel(gl, target, viewPixel(camera, facePoint(bottom.corners, 0.5, 0.5)))[0]).toBeLessThan((PROP_BASE & 0xff) + 20);
    stage.dispose();
  });

  it('shows the beam by default and hides it on request', () => {
    const stage = createStageScene(gl, stairsScene, leftRedRightGreen());
    const beam = (): boolean | undefined => stage.scene.getObjectByName('projector-beam')?.visible;
    expect(beam()).toBe(true);
    stage.setBeamVisible(false);
    expect(beam()).toBe(false);
    stage.setBeamVisible(true);
    expect(beam()).toBe(true);
    stage.dispose();
  });

  // The body has to read clearly against the dim room and backdrop.
  it('lights the projector body well above the dim room', () => {
    const stage = createStageScene(gl, stairsScene, leftRedRightGreen());
    stage.resize(VIEW.width, VIEW.height);
    const [px, py, pz] = stairsScene.projector.position;
    const from: Vec3 = [px + 1.2, py + 0.6, pz + 0.4];
    stage.camera.position.set(...from);
    stage.camera.lookAt(px, py, pz + 0.12);
    stage.setBeamVisible(false);
    drawInto(stage, target);
    const [r, g, b] = readPixel(gl, target, viewPixel(lookingCamera(from, [px, py, pz + 0.12]), [px - 0.07, py, pz + 0.12]));
    expect(Math.max(r, g, b)).toBeGreaterThan((ROOM_BASE & 0xff) + 40);
    stage.dispose();
  });

  it('places a projector body in the scene', () => {
    const stage = createStageScene(gl, stairsScene, leftRedRightGreen());
    expect(stage.scene.getObjectByName('projector-body')).toBeDefined();
    stage.dispose();
  });
});
