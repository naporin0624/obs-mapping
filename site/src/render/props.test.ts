import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { boxFrontFace } from '../scene/box-face';
import { drumHeadCenter, drumHeadFace, type DrumProp } from '../scene/drum-head-face';
import { hexPanelFace, type HexPanel } from '../scene/hex-panel-face';
import type { Prop, Vec3 } from '../scene/spec';
import { propGeometry } from './props';

type Box = Extract<Prop, { kind: 'box' }>;

const vertices = (g: THREE.BufferGeometry): THREE.Vector3[] => {
  const pos = g.getAttribute('position');
  return Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i));
};

const v3 = (v: Vec3): THREE.Vector3 => new THREE.Vector3(...v);

// Vertices (float32) lying in the plane through `origin` with normal `n`.
const inPlane = (g: THREE.BufferGeometry, origin: THREE.Vector3, n: THREE.Vector3): THREE.Vector3[] => vertices(g).filter((v) => Math.abs(v.clone().sub(origin).dot(n)) < 1e-5);

// Extent of points along an axis through the corner rectangle's centre.
const extent = (points: readonly THREE.Vector3[], origin: THREE.Vector3, axis: THREE.Vector3): readonly [number, number] => {
  const d = points.map((p) => p.clone().sub(origin).dot(axis));
  return [Math.min(...d), Math.max(...d)];
};

const rectAxes = ([tl, tr, , bl]: readonly [Vec3, Vec3, Vec3, Vec3]): { right: THREE.Vector3; up: THREE.Vector3 } => ({
  right: v3(tr).sub(v3(tl)).normalize(),
  up: v3(tl).sub(v3(bl)).normalize(),
});

const rectCenter = (corners: readonly [Vec3, Vec3, Vec3, Vec3]): THREE.Vector3 => corners.reduce((acc, c) => acc.add(v3(c)), new THREE.Vector3()).multiplyScalar(1 / 4);

describe('propGeometry', () => {
  it('puts the box front face exactly on boxFrontFace', () => {
    const box: Box = { kind: 'box', center: [0.4, 0.5, -0.3], size: [3, 0.3, 0.3], rotationY: 0.4 };
    const corners = boxFrontFace(box);
    const outward = v3(corners[1])
      .sub(v3(corners[0]))
      .cross(v3(corners[0]).sub(v3(corners[3])))
      .normalize();
    const geometry = propGeometry(box);
    const front = inPlane(geometry, v3(corners[0]), outward);
    corners.forEach((c) => expect(front.some((v) => v.distanceTo(v3(c)) < 1e-5)).toBe(true));
    // Nothing of the box lies in front of the face, so it is the projector-side face and not its back.
    for (const v of vertices(geometry)) expect(v.clone().sub(v3(corners[0])).dot(outward)).toBeLessThan(1e-5);
  });

  it('puts a flat-top hexagon on the front plane of hexPanelFace, filling its bounding rectangle', () => {
    const panel: HexPanel = { kind: 'hexPanel', center: [0.2, 1.4, 0.05], radius: 0.5, depth: 0.1, normal: [0.17, -0.07, 0.98] };
    const corners = hexPanelFace(panel);
    const origin = rectCenter(corners);
    const { right, up } = rectAxes(corners);
    const cap = inPlane(propGeometry(panel), origin, v3(panel.normal).normalize());
    const [minX, maxX] = extent(cap, origin, right);
    const [minY, maxY] = extent(cap, origin, up);
    expect([minX, maxX, minY, maxY].map((n) => n.toFixed(5))).toEqual([-0.5, 0.5, -Math.sqrt(3) / 4, Math.sqrt(3) / 4].map((n) => n.toFixed(5)));
  });

  it('puts the drum head circle on drumHeadFace, inscribed in its square', () => {
    const drum: DrumProp = { kind: 'drum', center: [-0.4, 1.3, -0.1], radius: 0.18, depth: 0.28, normal: [0.32, 0.64, 0.7] };
    const corners = drumHeadFace(drum);
    const origin = v3(drumHeadCenter(drum));
    const cap = inPlane(propGeometry(drum), origin, v3(drum.normal).normalize());
    expect(cap.length).toBeGreaterThan(8);
    cap.forEach((v) => expect(v.distanceTo(origin)).toBeLessThan(drum.radius + 1e-5));
    expect(Math.max(...cap.map((v) => v.distanceTo(origin)))).toBeCloseTo(drum.radius, 5);
    expect(rectCenter(corners).distanceTo(origin)).toBeLessThan(1e-5);
  });
});
