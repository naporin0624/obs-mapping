// The image mapped onto the panel, in height-normalised coordinates centred on the frame (y down).
const BLUE = vec3f(0.078, 0.201, 1.0);
const CYAN = vec3f(0.03, 0.62, 1.0);
const HOT = vec3f(0.85, 0.92, 1.0);

fn gauss(x: f32, width: f32) -> f32 {
  return exp(-(x * x) / (width * width));
}

fn sweep_y(x: f32) -> f32 {
  return -0.30 * x + 0.08 * sin(2.4 * x + 1.0);
}

export fn hero_light(q: vec2f) -> vec3f {
  let focal = vec2f(0.08, sweep_y(0.08));
  let along = q.x - focal.x;
  let d = q.y - sweep_y(q.x);
  let width = 0.025 + 0.07 * gauss(along, 0.3);
  let band = gauss(d, width) * gauss(along, 0.75);
  let fringe = band * smoothstep(0.35, 1.1, abs(d) / width);
  let echo = gauss(d - 0.17, 0.022) * gauss(along + 0.1, 0.55);
  let core = gauss(along, 0.12) * gauss(d, 0.05);
  let halo = gauss(length(q - focal), 0.3) * 0.08;
  return BLUE * (band * 1.6 + halo) + CYAN * (fringe * 0.9 + echo * 0.45) + HOT * core * 6.0;
}

export fn icon_light(q: vec2f) -> vec3f {
  let along = (q.x - q.y) * 0.7071;
  let d = (q.x + q.y) * 0.7071;
  let width = 0.045 + 0.04 * gauss(along, 0.18);
  let band = gauss(d, width) * smoothstep(0.5, 0.2, abs(along));
  let fringe = band * smoothstep(0.35, 1.1, abs(d) / width);
  let core = gauss(length(q), 0.07);
  return BLUE * band * 3.2 + CYAN * fringe * 0.9 + HOT * core * 5.0;
}
