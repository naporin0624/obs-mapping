struct Params { step: vec2f }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

// 9-tap Gaussian folded into 5 bilinear taps; `step` is one texel along the blur axis.
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let s1 = params.step * 1.3846154;
  let s2 = params.step * 3.2307692;
  let centre = textureSampleLevel(src, samp, uv, 0.0) * 0.2270270;
  let near = (textureSampleLevel(src, samp, uv + s1, 0.0) + textureSampleLevel(src, samp, uv - s1, 0.0)) * 0.3162162;
  let far = (textureSampleLevel(src, samp, uv + s2, 0.0) + textureSampleLevel(src, samp, uv - s2, 0.0)) * 0.0702703;
  return centre + near + far;
}
