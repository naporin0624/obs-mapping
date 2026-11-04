import * as THREE from 'three';

import type { Prop, Vec3 } from '../scene/spec';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const HEX_SIDES = 6;
const DRUM_SIDES = 48;

// Same right/up basis as hexPanelFace and drumHeadFace, so the cap lands on their face.
// Cylinder axis (local y) goes along the normal; its first rim vertex (local z) along right.
const capBasis = (center: Vec3, normal: Vec3): THREE.Matrix4 => {
  const n = new THREE.Vector3(...normal).normalize();
  const right = new THREE.Vector3().crossVectors(WORLD_UP, n).normalize();
  const up = new THREE.Vector3().crossVectors(n, right);
  return new THREE.Matrix4().makeBasis(up, n, right).setPosition(...center);
};

const prism = (radius: number, depth: number, sides: number, center: Vec3, normal: Vec3): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(radius, radius, depth, sides).applyMatrix4(capBasis(center, normal));

/** World-space geometry of a prop; the faces the projector hits match the scene's face helpers. */
export const propGeometry = (prop: Prop): THREE.BufferGeometry => {
  switch (prop.kind) {
    case 'box':
      return new THREE.BoxGeometry(...prop.size).rotateY(prop.rotationY).translate(...prop.center);
    case 'hexPanel':
      return prism(prop.radius, prop.depth, HEX_SIDES, prop.center, prop.normal);
    case 'drum':
      return prism(prop.radius, prop.depth, DRUM_SIDES, prop.center, prop.normal);
  }
};
