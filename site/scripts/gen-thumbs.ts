import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { preview } from 'astro';
import { chromium, type Browser, type Page } from 'playwright';

import { DEMO_SLUGS } from '../src/demos';
import type { DemoSlug } from '../src/scene/spec';

// 2x the widest common card thumbnail (about 330 CSS px on a phone), in the card's 16:10 slot.
const THUMB = { width: 720, height: 450 } as const;
const WEBP_QUALITY = 0.8;
const OUT_DIR = new URL('../src/assets/thumbs/', import.meta.url);
// Pinned to the top-left corner so the shot lands on whole pixels; the hint would otherwise sit in the shot.
const STAGE_SIZE = `[data-stage] { position: fixed !important; inset: 0 auto auto 0 !important; z-index: 1; width: ${String(THUMB.width)}px !important; height: ${String(THUMB.height)}px !important; } [data-hint] { visibility: hidden !important; }`;
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
// Wheel pixels toward the target from the default pose, so small subjects still read on a narrow card.
const ZOOM_IN: Record<DemoSlug, number> = { stairs: 200, hexagon: 0, drums: 400, cubes: 350 };

const nextFrames = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

const waitForStage = async (page: Page): Promise<void> => {
  const viewer = await page.waitForSelector('[data-demo-viewer][data-webgl]');
  const state = await viewer.getAttribute('data-webgl');
  if (state !== 'ok') throw new Error(`stage did not render WebGL (data-webgl=${String(state)})`);
  await nextFrames(page);
};

const zoomIn = async (page: Page, pixels: number): Promise<void> => {
  if (pixels === 0) return;
  await page.mouse.move(THUMB.width / 2, THUMB.height / 2);
  await page.mouse.wheel(0, -pixels);
  await nextFrames(page);
};

// Playwright only writes PNG or JPEG, so the browser re-encodes the shot as WebP.
const encodeWebp = (page: Page, png: Buffer): Promise<string> =>
  page.evaluate(
    async ({ dataUrl, quality }) => {
      const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    },
    { dataUrl: `data:image/png;base64,${png.toString('base64')}`, quality: WEBP_QUALITY },
  );

// Reduced motion snaps the steps to "done" and holds the sample at time 0, so every run draws the same frame.
const shootDemo = async (browser: Browser, origin: string, slug: DemoSlug): Promise<Buffer> => {
  const page = await browser.newPage({ viewport: { width: THUMB.width, height: 900 }, reducedMotion: 'reduce' });
  try {
    await page.goto(`${origin}/demo/${slug}/`);
    await page.addStyleTag({ content: STAGE_SIZE });
    await waitForStage(page);
    await zoomIn(page, ZOOM_IN[slug]);
    const png = await page.locator('[data-stage-canvas]').screenshot();
    return Buffer.from(await encodeWebp(page, png), 'base64');
  } finally {
    await page.close();
  }
};

const writeThumb = (slug: DemoSlug, webp: Buffer): void => {
  const file = new URL(`${slug}.webp`, OUT_DIR);
  writeFileSync(file, webp);
  console.log(`${fileURLToPath(file)} ${String(webp.byteLength)} bytes`);
};

/** Serves the built site and writes one WebP still of the finished stage per demo. */
const main = async (): Promise<void> => {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await preview({ root: fileURLToPath(new URL('..', import.meta.url)), logLevel: 'warn' });
  const browser = await chromium.launch({ args: SWIFTSHADER });
  try {
    const origin = `http://localhost:${String(server.port)}`;
    for (const slug of DEMO_SLUGS) writeThumb(slug, await shootDemo(browser, origin, slug));
  } finally {
    await browser.close();
    await server.stop();
  }
};

await main();
