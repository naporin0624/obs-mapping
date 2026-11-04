import { hash21 } from "./noise.wgsl";
import { tonemap, linear_to_srgb } from "./tone.wgsl";

struct Params {
  design: vec2f,
  exposure: f32,
  seed: f32,
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var near_glow: texture_2d<f32>;
@group(0) @binding(3) var mid_glow: texture_2d<f32>;
@group(0) @binding(4) var far_glow: texture_2d<f32>;
@group(0) @binding(5) var samp: sampler;

fn bloom(uv: vec2f) -> vec3f {
  let near = textureSampleLevel(near_glow, samp, uv, 0.0).rgb;
  let mid = textureSampleLevel(mid_glow, samp, uv, 0.0).rgb;
  let far = textureSampleLevel(far_glow, samp, uv, 0.0).rgb;
  return near * 0.5 + mid * 0.4 + far * 0.3;
}

fn vignette(uv: vec2f) -> f32 {
  let q = (uv - 0.5) * vec2f(1.0, 0.9);
  return 1.0 - smoothstep(0.35, 0.85, length(q)) * 0.5;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let base = textureSampleLevel(scene, samp, uv, 0.0).rgb;
  let lit = tonemap((base + bloom(uv)) * params.exposure) * vignette(uv);
  let p = floor(uv * params.design);
  let grain = (hash21(p + params.seed * 17.0) - 0.5) * (1.6 / 255.0);
  return vec4f(linear_to_srgb(lit) + grain, 1.0);
}
