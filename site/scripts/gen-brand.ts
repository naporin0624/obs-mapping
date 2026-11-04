import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { prepareShader } from '@vgpu/wgsl/prepare';
import { resolveShader } from '@vgpu/wgsl/runtime';
import { PNG } from 'pngjs';
import { effect, init, sampler, target } from 'vgpu/node';
import type { NodeGpu, ShaderSource, Target } from 'vgpu/node';

type Size = readonly [number, number];
type Art = { file: string; size: Size; pitch: number; dot: number; mode: 0 | 1; tilt: number; exposure: number };
type Shaders = Record<'panel' | 'downsample' | 'blur' | 'composite', ShaderSource>;
type Image = { width: number; height: number; rgba: Uint8Array };

// Rendered at 2x and box-filtered down, so the LED edges come out anti-aliased.
const SUPERSAMPLE = 2;
const SEED = 7;
// Each glow level is a quarter the size of the one before it.
const BLOOM_STEP = 4;
const ARTS: readonly Art[] = [
  { file: '../src/assets/brand/thumbnail.png', size: [1536, 804], pitch: 21, dot: 0.34, mode: 0, tilt: 0.35, exposure: 1.0 },
  { file: '../src/assets/brand/icon.png', size: [1024, 1024], pitch: 96, dot: 0.38, mode: 1, tilt: 0, exposure: 1.0 },
];

const loadShader = async (name: string): Promise<ShaderSource> => {
  const entry = fileURLToPath(new URL(`./brand/${name}.wgsl`, import.meta.url));
  return prepareShader(await resolveShader({ entry }), entry);
};

const loadShaders = async (): Promise<Shaders> => ({
  panel: await loadShader('panel'),
  downsample: await loadShader('downsample'),
  blur: await loadShader('blur'),
  composite: await loadShader('composite'),
});

const hdrTarget = (gpu: NodeGpu, size: Size): Target => target(gpu, { size: [size[0], size[1]], format: 'rgba16float' });

const blurPass = (gpu: NodeGpu, shaders: Shaders, src: Target, axis: Size): Target => {
  const out = hdrTarget(gpu, src.size);
  const step = [axis[0] / src.size[0], axis[1] / src.size[1]];
  effect(gpu, shaders.blur, { set: { params: { step }, src, samp: sampler(gpu, { minFilter: 'linear', magFilter: 'linear' }) } }).draw(out);
  return out;
};

const glowLevel = (gpu: NodeGpu, shaders: Shaders, src: Target): Target => {
  const small = hdrTarget(gpu, [Math.ceil(src.size[0] / BLOOM_STEP), Math.ceil(src.size[1] / BLOOM_STEP)]);
  const texel = [1 / src.size[0], 1 / src.size[1]];
  effect(gpu, shaders.downsample, { set: { params: { texel }, src, samp: sampler(gpu, { minFilter: 'linear', magFilter: 'linear' }) } }).draw(small);
  return blurPass(gpu, shaders, blurPass(gpu, shaders, small, [1, 0]), [0, 1]);
};

const renderArt = async (gpu: NodeGpu, shaders: Shaders, art: Art): Promise<Uint8Array> => {
  const size: Size = [art.size[0] * SUPERSAMPLE, art.size[1] * SUPERSAMPLE];
  const scene = hdrTarget(gpu, size);
  effect(gpu, shaders.panel, { set: { params: { design: art.size, pitch: art.pitch, dot: art.dot, mode: art.mode, tilt: art.tilt, seed: SEED } } }).draw(scene);
  const near = glowLevel(gpu, shaders, scene);
  const mid = glowLevel(gpu, shaders, near);
  const far = glowLevel(gpu, shaders, mid);
  const out = target(gpu, { size: [size[0], size[1]], format: 'rgba8unorm' });
  const samp = sampler(gpu, { minFilter: 'linear', magFilter: 'linear' });
  effect(gpu, shaders.composite, { set: { params: { design: art.size, exposure: art.exposure, seed: SEED }, scene, near_glow: near, mid_glow: mid, far_glow: far, samp } }).draw(out);
  return out.color.read({ mipLevel: 0, region: 'all' });
};

const srgbToLinear = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (c: number): number => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(Math.max(v, 0), 1) * 255);
};

const TO_LINEAR = Float64Array.from({ length: 256 }, (_, v) => srgbToLinear(v));

// Averages each factor x factor block in linear light so small bright dots keep their weight.
const boxAverage = (src: Image, factor: number, x: number, y: number, channel: number): number => {
  const offsets = Array.from({ length: factor * factor }, (_, i) => ((y * factor + Math.floor(i / factor)) * src.width + x * factor + (i % factor)) * 4 + channel);
  const sum = offsets.reduce((acc, offset) => acc + (TO_LINEAR[src.rgba[offset] ?? 0] ?? 0), 0);
  return linearToSrgb(sum / offsets.length);
};

const downsample = (src: Image, factor: number): Image => {
  const width = src.width / factor;
  const height = src.height / factor;
  const rgba = new Uint8Array(width * height * 4);
  rgba.forEach((_, i) => {
    const pixel = Math.floor(i / 4);
    const channel = i % 4;
    rgba[i] = channel === 3 ? 255 : boxAverage(src, factor, pixel % width, Math.floor(pixel / width), channel);
  });
  return { width, height, rgba };
};

const encodePng = (image: Image): Buffer => {
  const png = new PNG({ width: image.width, height: image.height });
  png.data.set(image.rgba);
  return PNG.sync.write(png, { colorType: 2, deflateLevel: 9 });
};

const writeArt = async (gpu: NodeGpu, shaders: Shaders, art: Art): Promise<void> => {
  const started = performance.now();
  const rendered = await renderArt(gpu, shaders, art);
  const image = downsample({ width: art.size[0] * SUPERSAMPLE, height: art.size[1] * SUPERSAMPLE, rgba: rendered }, SUPERSAMPLE);
  const png = encodePng(image);
  const file = fileURLToPath(new URL(art.file, import.meta.url));
  writeFileSync(file, png);
  console.log(`wrote ${file} (${String(image.width)}x${String(image.height)}, ${String(png.length)} bytes) in ${String(Math.round(performance.now() - started))} ms`);
};

const main = async (): Promise<void> => {
  const shaders = await loadShaders();
  const gpu = await init();
  try {
    for (const art of ARTS) {
      await writeArt(gpu, shaders, art);
    }
  } finally {
    gpu.dispose();
  }
};

await main();
