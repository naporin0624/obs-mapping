struct Params { texel: vec2f }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

// Four bilinear taps average a 4x4 source block, so small LEDs do not flicker in and out.
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let o = params.texel;
  let a = textureSampleLevel(src, samp, uv + vec2f(-o.x, -o.y), 0.0);
  let b = textureSampleLevel(src, samp, uv + vec2f(o.x, -o.y), 0.0);
  let c = textureSampleLevel(src, samp, uv + vec2f(-o.x, o.y), 0.0);
  let d = textureSampleLevel(src, samp, uv + vec2f(o.x, o.y), 0.0);
  return (a + b + c + d) * 0.25;
}
