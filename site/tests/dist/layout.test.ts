import { createReadStream } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};
// 28rem at the default 16px root size: the tallest a screenshot may be drawn.
const MAX_THUMB_HEIGHT = 448;

// Directory URLs such as /en/ serve their index.html.
const fileFor = (url: string): string => {
  const path = join(DIST, decodeURIComponent(new URL(url, 'http://dist').pathname));
  return extname(path) === '' ? join(path, 'index.html') : path;
};

const serveDist = (): Server =>
  createServer((req, res) => {
    const file = fileFor(req.url ?? '/');
    const stream = createReadStream(file);
    stream.on('open', () => {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      stream.pipe(res);
    });
    stream.on('error', () => res.writeHead(404).end());
  });

type Box = { name: string; width: number; height: number; attrWidth: number; attrHeight: number };

const thumbBoxes = (page: Page): Promise<Box[]> =>
  page.$$eval('[data-guide-media] img', (imgs) =>
    imgs.map((img) => {
      const rect = img.getBoundingClientRect();
      return { name: img.getAttribute('src') ?? '', width: rect.width, height: rect.height, attrWidth: Number(img.getAttribute('width')), attrHeight: Number(img.getAttribute('height')) };
    }),
  );

// Starts every thumbnail's download now and waits for all of them.
const loadThumbs = (page: Page): Promise<void> =>
  page.$$eval('[data-guide-media] img', async (imgs) => {
    await Promise.all(
      imgs.map((img) => {
        img.setAttribute('loading', 'eager');
        return img.decode();
      }),
    );
  });

// Smooth scrolling finishes on scrollend; a jump that needs no scroll never fires it.
const jumpTo = async (page: Page, id: string): Promise<number> =>
  page.evaluate(
    (target) =>
      new Promise<number>((resolve) => {
        const done = (): void => resolve(document.getElementById(target)?.getBoundingClientRect().top ?? Number.NaN);
        addEventListener('scrollend', done, { once: true });
        setTimeout(done, 5000);
        const link = document.querySelector<HTMLAnchorElement>(`a[href="#${target}"]`);
        link?.click();
      }),
    id,
  );

let server: Server;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = serveDist();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

describe.each([1280, 375])('guide screenshots at %ipx', (width) => {
  it('reserve their final box before the image arrives', async () => {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    // Holds every screenshot download open so the boxes are measured with nothing loaded.
    await page.route('**/_astro/*.webp', () => undefined);
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    const before = await thumbBoxes(page);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await loadThumbs(page);
    const after = await thumbBoxes(page);
    await page.close();

    expect(before).toHaveLength(10);
    for (const [i, box] of before.entries()) {
      expect(box.height, box.name).toBeGreaterThan(0);
      expect(box.width, box.name).toBeCloseTo(after[i]?.width ?? -1, 0);
      expect(box.height, box.name).toBeCloseTo(after[i]?.height ?? -1, 0);
    }
  });

  it('keep each screenshot undistorted, no wider than its file and no taller than 28rem', async () => {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(`${origin}/`);
    await loadThumbs(page);
    const boxes = await thumbBoxes(page);
    await page.close();

    for (const box of boxes) {
      expect(box.width / box.height, box.name).toBeCloseTo(box.attrWidth / box.attrHeight, 1);
      expect(box.width, box.name).toBeLessThanOrEqual(box.attrWidth + 0.5);
      expect(box.height, box.name).toBeLessThanOrEqual(MAX_THUMB_HEIGHT + 0.5);
    }
  });
});

describe('in-page jumps with smooth scrolling', () => {
  it.each([
    [375, 'faq', 64],
    [375, 'faq-dock', 64],
    [375, 'install-run', 64],
    [1280, 'how-transfer', 24],
  ])('at %ipx, #%s stops at its %ipx scroll margin', async (width, id, margin) => {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(`${origin}/`);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('smooth');
    const top = await jumpTo(page, id);
    await page.close();
    expect(top).toBeCloseTo(margin, 0);
  });

  it('jumps without animation when the reader asks for less motion', async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(`${origin}/`);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    await page.close();
  });
});
