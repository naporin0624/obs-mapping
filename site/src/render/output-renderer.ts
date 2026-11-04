import * as THREE from 'three';

import { invert3, unitSquareToQuad, type Mat3 } from '../../../ui/src/geometry/homography';
import { isGroupNode } from '../../../ui/src/model/layers';
import { MASK_MAX_POINTS, type LayerNode, type Mapping, type Mask, type Surface } from '../../../ui/src/model/mapping';
import { CANVAS } from '../scene/spec';
import type { Frame } from '../story/stage-frame';
import { MASK_ELLIPSE, MASK_NONE, MASK_POLYGON, OUTPUT_FRAGMENT, OUTPUT_VERTEX } from './output.glsl';

// The texture is y-up like any render target: canvas row y is texture row height - 1 - y.
export type OutputRenderer = {
  target: THREE.WebGLRenderTarget;
  texture: THREE.Texture;
  render(frame: Frame, source: THREE.Texture): void;
  dispose(): void;
};

type Warp = { surface: Surface; inv: Mat3 };
type SurfaceDraw = { mesh: THREE.Mesh; show(warp: Warp, source: THREE.Texture, maskAmount: number): void; hide(): void; dispose(): void };

// Surfaces in layer (depth-first) order, dropping those hidden directly or by a hidden group.
const drawOrder = (m: Mapping): Surface[] => {
  const surfaces = new Map(m.surfaces.map((s) => [s.id, s]));
  const groupVisible = new Map(m.groups.map((g) => [g.id, g.visible]));
  const walk = (nodes: readonly LayerNode[]): Surface[] =>
    nodes.flatMap((n) => {
      if (isGroupNode(n)) return groupVisible.get(n.group) === true ? walk(n.children) : [];
      const s = surfaces.get(n.surface);
      return s?.visible === true ? [s] : [];
    });
  return walk(m.layers);
};

// Degenerate quads have no inverse and are skipped, as in the plugin.
const toWarp = (surface: Surface): Warp[] => {
  const h = unitSquareToQuad(surface.corners);
  const inv = h === null ? null : invert3(h);
  return inv === null ? [] : [{ surface, inv }];
};

const maskTypeOf = (mask: Mask | undefined): number => {
  switch (mask?.type) {
    case 'ellipse':
      return MASK_ELLIPSE;
    case 'polygon':
      return MASK_POLYGON;
    case undefined:
      return MASK_NONE;
  }
};

type OutputUniforms = {
  source: THREE.IUniform<THREE.Texture | null>;
  invH: THREE.IUniform<THREE.Matrix3>;
  crop: THREE.IUniform<THREE.Vector4>;
  canvasHeight: THREE.IUniform<number>;
  maskAmount: THREE.IUniform<number>;
  maskType: THREE.IUniform<number>;
  maskEllipse: THREE.IUniform<THREE.Vector4>;
  maskPoints: THREE.IUniform<THREE.Vector2[]>;
  maskCount: THREE.IUniform<number>;
};

const createUniforms = (): OutputUniforms => ({
  source: { value: null },
  invH: { value: new THREE.Matrix3() },
  crop: { value: new THREE.Vector4() },
  canvasHeight: { value: CANVAS.height },
  maskAmount: { value: 0 },
  maskType: { value: MASK_NONE },
  maskEllipse: { value: new THREE.Vector4() },
  maskPoints: { value: Array.from({ length: MASK_MAX_POINTS }, () => new THREE.Vector2()) },
  maskCount: { value: 0 },
});

const createMaterial = (uniforms: OutputUniforms): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader: OUTPUT_VERTEX,
    fragmentShader: OUTPUT_FRAGMENT,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

// One full-screen plane per drawn surface; renderOrder keeps the layer order.
const createSurfaceDraw = (order: number): SurfaceDraw => {
  const u = createUniforms();
  const material = createMaterial(u);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;

  const setMask = (mask: Mask | undefined): void => {
    const points = mask?.type === 'polygon' ? mask.points.slice(0, MASK_MAX_POINTS) : [];
    u.maskType.value = maskTypeOf(mask);
    u.maskCount.value = points.length;
    points.forEach(([x, y], i) => u.maskPoints.value[i]?.set(x, y));
    if (mask?.type === 'ellipse') u.maskEllipse.value.set(mask.x, mask.y, mask.width, mask.height);
  };

  const show = ({ surface, inv }: Warp, source: THREE.Texture, maskAmount: number): void => {
    mesh.visible = true;
    u.source.value = source;
    u.maskAmount.value = maskAmount;
    u.invH.value.set(...inv);
    u.crop.value.set(surface.crop.x, surface.crop.y, surface.crop.width, surface.crop.height);
    setMask(surface.mask);
  };

  const dispose = (): void => {
    material.dispose();
    mesh.geometry.dispose();
  };

  const hide = (): void => {
    mesh.visible = false;
  };

  return { mesh, show, hide, dispose };
};

const clearTransparent = (gl: THREE.WebGLRenderer): void => {
  gl.setClearColor(0x000000, 0);
  gl.clear(true, true, true);
};

export const createOutputRenderer = (gl: THREE.WebGLRenderer): OutputRenderer => {
  const target = new THREE.WebGLRenderTarget(CANVAS.width, CANVAS.height, { depthBuffer: false });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  let pool: readonly SurfaceDraw[] = [];

  const ensurePool = (size: number): void => {
    const added = Array.from({ length: Math.max(0, size - pool.length) }, (_, i) => createSurfaceDraw(pool.length + i));
    added.forEach((d) => scene.add(d.mesh));
    pool = [...pool, ...added];
  };

  const layout = (warps: readonly Warp[], source: THREE.Texture, maskAmount: number): void => {
    ensurePool(warps.length);
    pool.forEach((d, i) => {
      const warp = warps[i];
      if (warp === undefined) d.hide();
      else d.show(warp, source, maskAmount);
    });
  };

  const render = (frame: Frame, source: THREE.Texture): void => {
    const previous = { target: gl.getRenderTarget(), color: gl.getClearColor(new THREE.Color()), alpha: gl.getClearAlpha() };
    layout(drawOrder(frame.mapping).flatMap(toWarp), source, frame.maskAmount);
    gl.setRenderTarget(target);
    clearTransparent(gl);
    gl.render(scene, camera);
    gl.setClearColor(previous.color, previous.alpha);
    gl.setRenderTarget(previous.target);
  };

  const dispose = (): void => {
    pool.forEach((d) => d.dispose());
    target.dispose();
  };

  return { target, texture: target.texture, render, dispose };
};
