import { MASK_MAX_POINTS } from '../../../ui/src/model/mapping';

export const MASK_NONE = 0;
export const MASK_ELLIPSE = 1;
export const MASK_POLYGON = 2;

export const OUTPUT_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Mirrors PSWarp in data/effects/warp.effect; the mask is tested analytically instead of via an R8 texture.
export const OUTPUT_FRAGMENT = /* glsl */ `
#define MASK_MAX_POINTS ${String(MASK_MAX_POINTS)}

uniform sampler2D source;
uniform mat3 invH;
uniform vec4 crop;
uniform float canvasHeight;
uniform float maskAmount;
uniform int maskType;
uniform vec4 maskEllipse;
uniform vec2 maskPoints[MASK_MAX_POINTS];
uniform int maskCount;

bool crosses(vec2 p, vec2 a, vec2 b) {
  return (a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x;
}

float polygonCoverage(vec2 p) {
  bool inside = false;
  for (int i = 0; i < MASK_MAX_POINTS; i++) {
    if (i >= maskCount) break;
    vec2 a = maskPoints[i];
    vec2 b = maskPoints[i + 1 < maskCount ? i + 1 : 0];
    if (crosses(p, a, b)) inside = !inside;
  }
  return inside ? 1.0 : 0.0;
}

float ellipseCoverage(vec2 p) {
  vec2 r = maskEllipse.zw * 0.5;
  vec2 d = (p - (maskEllipse.xy + r)) / r;
  return dot(d, d) <= 1.0 ? 1.0 : 0.0;
}

float coverage(vec2 s) {
  if (maskType == ${String(MASK_ELLIPSE)}) return ellipseCoverage(s);
  if (maskType == ${String(MASK_POLYGON)}) return polygonCoverage(s);
  return 1.0;
}

void main() {
  vec2 canvasPx = vec2(gl_FragCoord.x, canvasHeight - gl_FragCoord.y);
  vec3 h = invH * vec3(canvasPx, 1.0);
  if (h.z <= 1e-8) discard;
  vec2 s = h.xy / h.z;
  if (any(lessThan(s, vec2(0.0))) || any(greaterThan(s, vec2(1.0)))) discard;

  vec2 src = crop.xy + s * crop.zw;
  vec4 texel = texture2D(source, vec2(src.x, 1.0 - src.y));
  gl_FragColor = texel * mix(1.0, coverage(s), maskAmount);
}
`;
