export fn tonemap(c: vec3f) -> vec3f {
  return vec3f(1.0) - exp(-c);
}

export fn linear_to_srgb(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}
