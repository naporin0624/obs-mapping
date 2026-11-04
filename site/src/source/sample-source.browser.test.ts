import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { createSampleSource } from './sample-source';

const canvasOf = (texture: { image: unknown }): HTMLCanvasElement => {
  if (!(texture.image instanceof HTMLCanvasElement)) throw new Error('expected a canvas image');
  return texture.image;
};

const samplePixel = (canvas: HTMLCanvasElement): readonly number[] => {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('no 2d context');
  return Array.from(ctx.getImageData(canvas.width / 4, canvas.height / 4, 1, 1).data);
};

describe('createSampleSource', () => {
  it('draws a 1920x1080 canvas', () => {
    const source = createSampleSource();
    const canvas = canvasOf(source.texture);
    expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
    source.stop();
  });

  it('animates: the sampled pixel differs between t=0 and t=1000', () => {
    const source = createSampleSource();
    const canvas = canvasOf(source.texture);
    source.update(0);
    const first = samplePixel(canvas);
    source.update(1000);
    const second = samplePixel(canvas);
    expect(second).not.toEqual(first);
    source.stop();
  });

  it('is always ready', () => {
    const source = createSampleSource();
    expect(source.ready()).toBe(true);
    source.stop();
  });

  it('passes colour through untouched', () => {
    const source = createSampleSource();
    expect(source.texture.colorSpace).toBe(THREE.NoColorSpace);
    source.stop();
  });
});
