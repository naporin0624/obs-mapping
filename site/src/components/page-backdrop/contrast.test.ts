import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { converter, parse } from 'culori';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { cannelloniPreset } from '../../../../ui/src/design/cannelloni-preset';
import { BACKDROP_ALPHA } from './styles.css';

type Rgb = readonly [number, number, number];

const colors = cannelloniPreset.theme.extend.tokens.colors;
const toSrgb = converter('rgb');
const token = (value: string): Rgb => {
  const c = toSrgb(parse(value));
  if (c === undefined) throw new Error(`unparsable colour: ${value}`);
  return [c.r, c.g, c.b];
};

const canvas = token(colors.dark.canvas.value);
const text = { 'fg.default': token(colors.gray['1'].value), 'fg.muted': token(colors.gray['6'].value), 'accent.text': token(colors.neon.blue.value) };
const focusRing = token(colors.neon.blue.value);

const channel = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: Rgb): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};
const over = (alpha: number, fg: Rgb, bg: Rgb): Rgb => [0, 1, 2].map((i) => alpha * (fg[i] ?? 0) + (1 - alpha) * (bg[i] ?? 0)) as unknown as Rgb;

// Per-channel maxima, taken independently, are at least as bright as any pixel.
// That bounds Astro's downscaled output too (resampling overshoot), so no downscale emulation is needed.
const brightestPossible = (): Rgb => {
  const { data } = PNG.sync.read(readFileSync(fileURLToPath(new URL('../../assets/brand/thumbnail.png', import.meta.url))));
  const max = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) max[c] = Math.max(max[c] ?? 0, data[i + c] ?? 0);
  return max.map((v) => v / 255) as unknown as Rgb;
};

const worst = brightestPossible();
const backdropUnder = (alpha: number): Rgb => over(alpha, canvas, worst);

describe('page backdrop overlay', () => {
  it('measures a real, non-trivial worst-case pixel', () => {
    expect(luminance(worst)).toBeGreaterThan(0.1);
  });

  it.each(Object.entries(text))('keeps %s at 4.5:1 on the brightest possible pixel', (_name, color) => {
    expect(contrast(color, backdropUnder(BACKDROP_ALPHA))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the focus ring at 3:1', () => {
    expect(contrast(focusRing, backdropUnder(BACKDROP_ALPHA))).toBeGreaterThanOrEqual(3);
  });

  it('is not more opaque than needed (image stays visible)', () => {
    expect(BACKDROP_ALPHA).toBeLessThanOrEqual(0.95);
  });
});
