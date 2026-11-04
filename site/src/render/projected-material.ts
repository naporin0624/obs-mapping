import * as THREE from 'three';

import { PROJECTOR_DEPTH_SIZE } from './projector-depth';

const VERTEX = /* glsl */ `
uniform mat4 projectorMatrix;
varying vec4 vProjected;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vProjected = projectorMatrix * world;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// Output texture is y-up like NDC, so uv = ndc * 0.5 + 0.5 needs no flip.
// Colours pass through untouched (no colorspace_fragment), as the plugin does no conversion.
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform sampler2D projectorDepth;
uniform vec2 depthTexel;
uniform float projectorNear;
uniform float projectorFar;
uniform vec3 projectorPosition;
uniform vec3 base;
varying vec4 vProjected;
varying vec3 vWorld;
varying vec3 vNormal;

float viewDistance(float depth) {
  float z = depth * 2.0 - 1.0;
  return 2.0 * projectorNear * projectorFar / (projectorFar + projectorNear - z * (projectorFar - projectorNear));
}

// Nearest depth within two texels of uv: a surface right beside a nearer silhouette counts as hidden, so the
// output's anti-aliased, filtered edge never spills onto what lies behind it.
float nearestAround(vec2 uv) {
  float nearest = 1.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) nearest = min(nearest, texture2D(projectorDepth, uv + vec2(x, y) * 2.0 * depthTexel).r);
  }
  return nearest;
}

// Compared as distance along the view axis (clip w); the bias grows at grazing angles.
bool occluded(vec2 uv, float facing) {
  return vProjected.w > viewDistance(nearestAround(uv)) + 0.01 / max(facing, 0.2);
}

// Faces the projector only grazes catch almost none of its light; anything steeper keeps it all.
float grazingFade(float facing) {
  return smoothstep(0.03, 0.15, facing);
}

float facingProjector() {
  return dot(normalize(vNormal), normalize(projectorPosition - vWorld));
}

bool lit(float facing) {
  if (vProjected.w <= 0.0) return false;
  vec2 ndc = vProjected.xy / vProjected.w;
  if (any(greaterThan(abs(ndc), vec2(1.0)))) return false;
  return facing > 0.0 && !occluded(ndc * 0.5 + 0.5, facing);
}

// Anything clearly lit shows the picture's own colour; black parts of the picture leave the base.
const float COVERAGE_GAIN = 4.0;

float lightCoverage(vec3 light) {
  return clamp(max(light.r, max(light.g, light.b)) * COVERAGE_GAIN, 0.0, 1.0);
}

void main() {
  float facing = facingProjector();
  vec3 light = lit(facing) ? texture2D(map, vProjected.xy / vProjected.w * 0.5 + 0.5).rgb * grazingFade(facing) : vec3(0.0);
  gl_FragColor = vec4(mix(base, light, lightCoverage(light)), 1.0);
}
`;

/** `base` is a raw sRGB hex, uploaded without conversion like the output texture; `depth` comes from createProjectorDepth. */
export const createProjectedMaterial = (projector: THREE.PerspectiveCamera, map: THREE.Texture, base: number, depth: THREE.Texture): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      projectorDepth: { value: depth },
      depthTexel: { value: new THREE.Vector2(1 / PROJECTOR_DEPTH_SIZE.width, 1 / PROJECTOR_DEPTH_SIZE.height) },
      projectorNear: { value: projector.near },
      projectorFar: { value: projector.far },
      base: { value: new THREE.Color().setHex(base, THREE.NoColorSpace) },
      projectorPosition: { value: projector.getWorldPosition(new THREE.Vector3()) },
      projectorMatrix: { value: new THREE.Matrix4().multiplyMatrices(projector.projectionMatrix, projector.matrixWorldInverse) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
