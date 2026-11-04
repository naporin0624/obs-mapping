import { describe, expect, it } from 'vitest';

import { centeredRegion, isLetterboxed, letterbox } from './frame-fit';

describe('letterbox', () => {
  it('fills the 16:9 frame with a 16:9 video', () => {
    expect(letterbox(1920, 1080)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('puts a 4:3 video in the middle with black bars left and right', () => {
    expect(letterbox(640, 480)).toEqual({ x: 0.125, y: 0, width: 0.75, height: 1 });
  });

  it('keeps a portrait video at full height, narrow and centred', () => {
    const rect = letterbox(1080, 1920);
    expect(rect.y).toBe(0);
    expect(rect.height).toBe(1);
    expect(rect.width).toBeCloseTo(81 / 256, 6);
    expect(rect.x).toBeCloseTo((1 - rect.width) / 2, 6);
  });

  it('keeps an ultra-wide video at full width with bars above and below', () => {
    const rect = letterbox(2560, 1080);
    expect(rect.x).toBe(0);
    expect(rect.width).toBe(1);
    expect(rect.height).toBeCloseTo(1920 / 2560, 6);
    expect(rect.y).toBeCloseTo((1 - rect.height) / 2, 6);
  });

  it('fills the frame before metadata arrives', () => {
    expect(letterbox(0, 0)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe('isLetterboxed', () => {
  it.each([
    [1920, 1080, false],
    [1280, 720, false],
    [640, 480, true],
    [1080, 1920, true],
    [0, 0, false],
  ])('%i x %i -> %s', (w, h, expected) => {
    expect(isLetterboxed(w, h)).toBe(expected);
  });
});

describe('centeredRegion', () => {
  it('takes the centred square of a 16:9 source', () => {
    expect(centeredRegion(16 / 9, 1)).toEqual({ x: 7 / 32, y: 0, width: 9 / 16, height: 1 });
  });

  it('takes a centred full-width band when the target is wider', () => {
    const region = centeredRegion(16 / 9, 2);
    expect(region.x).toBe(0);
    expect(region.width).toBe(1);
    expect(region.height).toBeCloseTo(8 / 9, 9);
    expect(region.y).toBeCloseTo(1 / 18, 9);
  });
});
