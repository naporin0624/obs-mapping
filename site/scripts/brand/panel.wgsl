import { hash21 } from "./noise.wgsl";
import { hero_light, icon_light } from "./light.wgsl";

struct Params {
  // Layout space in output pixels; the target may be a multiple of it for supersampling.
  design: vec2f,
  pitch: f32,
  // LED radius as a fraction of the pitch.
  dot: f32,
  // 0 = hero image on an endless tilted panel, 1 = icon image on a bounded flat panel.
  mode: f32,
  // Panel rotation about the vertical axis, in radians.
  tilt: f32,
  seed: f32,
}
@group(0) @binding(0) var<uniform> params: Params;

const BG = vec3f(0.0034, 0.0040, 0.0060);
const UNLIT = vec3f(0.0025, 0.004, 0.010);
// Camera distance in frame heights; the panel keeps its scale at the frame centre.
const CAMERA = 1.6;

// Screen pixel -> point on the tilted panel, in the same pixel units.
fn to_panel(p: vec2f) -> vec2f {
  let s = (p - params.design * 0.5) / params.design.y;
  let x = s.x * CAMERA / (CAMERA * cos(params.tilt) - s.x * sin(params.tilt));
  let y = s.y * (CAMERA + x * sin(params.tilt)) / CAMERA;
  return vec2f(x, y) * params.design.y + params.design * 0.5;
}

// Whole cells only, leaving at least half a pitch of margin on each side.
fn grid_count() -> vec2f {
  return floor(params.design / params.pitch - 1.0);
}

fn grid_origin() -> vec2f {
  let count = grid_count();
  return (params.design - count * params.pitch) * 0.5;
}

fn in_grid(cell: vec2f) -> f32 {
  let count = grid_count();
  let inside = all(cell >= vec2f(0.0)) && all(cell < count);
  return select(1.0, select(0.0, 1.0, inside), params.mode > 0.5);
}

fn mapped_light(centre: vec2f) -> vec3f {
  let q = (centre - params.design * 0.5) / params.design.y;
  return select(hero_light(q), icon_light(q), params.mode > 0.5);
}

// Every pixel of a cell shows the colour sampled at the cell centre, like a real LED.
fn led(cell: vec2f, centre: vec2f) -> vec3f {
  let jitter = 0.86 + 0.28 * hash21(cell + params.seed);
  return UNLIT + mapped_light(centre) * jitter;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = to_panel(uv * params.design);
  let aa = max(length(fwidth(p)) * 0.7071, 1e-3);
  let cell = floor((p - grid_origin()) / params.pitch);
  let centre = grid_origin() + (cell + 0.5) * params.pitch;
  let r = params.pitch * params.dot;
  let dist = length(p - centre);
  let body = clamp((r - dist) / aa + 0.5, 0.0, 1.0) * in_grid(cell);
  let profile = 0.7 + 0.3 * smoothstep(r, 0.0, dist);
  return vec4f(BG + led(cell, centre) * body * profile, 1.0);
}
