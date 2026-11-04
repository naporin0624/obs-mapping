import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GITHUB = 'https://github.com/naporin0624/obs-mapping';
const SLUGS = ['stairs', 'hexagon', 'drums', 'cubes'] as const;

const page = (path: string): string => readFileSync(fileURLToPath(new URL(`../../dist/${path}`, import.meta.url)), 'utf8');

// Quoted values may hold '>' (Panda class names such as `[@media_(width_>=_900px)]:h_100%`).
const tagsOf = (html: string, tag: string): string[] => html.match(new RegExp(`<${tag}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'g')) ?? [];
const attr = (tagSource: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(tagSource)?.[1];
const hrefs = (html: string): string[] => tagsOf(html, 'a').flatMap((a) => attr(a, 'href') ?? []);
// Inline styles plus every stylesheet the page links, as Astro may emit either.
const stylesOf = (html: string): string =>
  [
    html,
    ...tagsOf(html, 'link')
      .filter((l) => attr(l, 'rel') === 'stylesheet')
      .map((l) => page((attr(l, 'href') ?? '').replace(/^\//, ''))),
  ].join('\n');
const alternates = (html: string): Record<string, string> =>
  Object.fromEntries(
    tagsOf(html, 'link')
      .filter((l) => attr(l, 'rel') === 'alternate')
      .map((l) => [attr(l, 'hreflang') ?? '', attr(l, 'href') ?? '']),
  );

describe('demo index', () => {
  it('ja links to every demo', () => {
    const links = hrefs(page('demo/index.html'));
    for (const slug of SLUGS) expect(links).toContain(`/demo/${slug}/`);
  });

  it('en links to every demo under /en', () => {
    const links = hrefs(page('en/demo/index.html'));
    for (const slug of SLUGS) expect(links).toContain(`/en/demo/${slug}/`);
  });

  it('each language links to the same page in the other language', () => {
    expect(hrefs(page('demo/index.html'))).toContain('/en/demo/');
    expect(hrefs(page('en/demo/index.html'))).toContain('/demo/');
  });

  it('emits hreflang alternates for self, other and x-default', () => {
    expect(alternates(page('demo/index.html'))).toEqual({ ja: '/demo/', en: '/en/demo/', 'x-default': '/demo/' });
    expect(alternates(page('en/demo/index.html'))).toEqual({ ja: '/demo/', en: '/en/demo/', 'x-default': '/demo/' });
  });

  it('cards show a decorative, lazily loaded still of each demo room with its size reserved', () => {
    for (const path of ['demo/index.html', 'en/demo/index.html']) {
      const imgs = tagsOf(page(path), 'img');
      for (const slug of SLUGS) {
        const thumbs = imgs.filter((img) => new RegExp(`^/_astro/${slug}\\.[\\w-]+\\.webp$`).test(attr(img, 'src') ?? ''));
        expect(thumbs).toHaveLength(1);
        const [thumb = ''] = thumbs;
        expect(Number(attr(thumb, 'width'))).toBeGreaterThan(0);
        expect(Number(attr(thumb, 'height'))).toBeGreaterThan(0);
        // Astro prints an empty alt as the bare attribute, which HTML reads as alt="".
        expect(thumb).toMatch(/\salt(=""|[\s>])/);
        expect(attr(thumb, 'loading')).toBe('lazy');
      }
    }
  });
});

describe('root pages', () => {
  it('ja links to the demos and GitHub', () => {
    const links = hrefs(page('index.html'));
    expect(links).toContain('/demo/');
    expect(links).toContain(GITHUB);
    expect(links).toContain('/en/');
  });

  it('en links to the demos and GitHub', () => {
    const links = hrefs(page('en/index.html'));
    expect(links).toContain('/en/demo/');
    expect(links).toContain(GITHUB);
    expect(links).toContain('/');
  });

  it('declares each page language', () => {
    expect(page('index.html')).toContain('<html lang="ja"');
    expect(page('en/index.html')).toContain('<html lang="en"');
  });
});

describe('demo viewer pages', () => {
  it('link to the other language and carry hreflang alternates', () => {
    for (const slug of SLUGS) {
      expect(hrefs(page(`demo/${slug}/index.html`))).toContain(`/en/demo/${slug}/`);
      expect(hrefs(page(`en/demo/${slug}/index.html`))).toContain(`/demo/${slug}/`);
      expect(alternates(page(`demo/${slug}/index.html`))).toEqual({ ja: `/demo/${slug}/`, en: `/en/demo/${slug}/`, 'x-default': `/demo/${slug}/` });
    }
  });

  it('offer a sample pause button and a busy message that names OBS', () => {
    const html = page('demo/stairs/index.html');
    const [sample] = tagsOf(html, 'button').filter((b) => b.includes('data-sample-toggle'));
    expect(sample === undefined ? undefined : attr(sample, 'data-play')).toBe('サンプル映像を再生');
    expect(html).toMatch(/data-busy="[^"]*OBS/);
  });

  it('choose the input with native radios, sample first and checked', () => {
    const radios = tagsOf(page('demo/stairs/index.html'), 'input').filter((i) => attr(i, 'name') === 'source');
    expect(radios.map((r) => attr(r, 'value'))).toEqual(['sample', 'obs']);
    expect(radios[0]).toMatch(/\schecked/);
    expect(page('demo/stairs/index.html')).toContain('OBS 仮想カメラ');
    expect(page('en/demo/stairs/index.html')).toContain('OBS Virtual Camera');
  });

  it('list the steps as radios in a fieldset with the finished step checked', () => {
    for (const slug of SLUGS) {
      const html = page(`demo/${slug}/index.html`);
      expect(html).toMatch(/<fieldset\b[^>]*data-steps/);
      const steps = tagsOf(html, 'input').filter((i) => attr(i, 'name') === 'step');
      expect(steps.at(-1)).toMatch(/value="done"[^>]*\schecked|\schecked[^>]*value="done"/);
      expect(steps.filter((s) => /\schecked/.test(s))).toHaveLength(1);
    }
  });

  it('show the projection area by default and offer a reset view button', () => {
    const html = page('demo/stairs/index.html');
    const [beam] = tagsOf(html, 'input').filter((i) => i.includes('data-beam'));
    expect(beam).toMatch(/type="checkbox"/);
    expect(beam).toMatch(/\schecked/);
    expect(tagsOf(html, 'button').some((b) => b.includes('data-reset-view'))).toBe(true);
  });

  it('keep the mapping.json download and the Demo Camera note in the OBS steps', () => {
    for (const slug of SLUGS) {
      const html = page(`demo/${slug}/index.html`);
      const [download] = tagsOf(html, 'a').filter((a) => attr(a, 'download') !== undefined);
      expect(download === undefined ? undefined : attr(download, 'href')).toBe(`/demo/${slug}.mapping.json`);
      expect(html).toContain('Demo Camera');
    }
  });

  it('make the 3D view focusable and describe it with the hint', () => {
    const [stage] = tagsOf(page('demo/stairs/index.html'), 'div').filter((d) => d.includes('data-stage'));
    expect(stage === undefined ? undefined : attr(stage, 'tabindex')).toBe('0');
    expect(stage === undefined ? undefined : attr(stage, 'aria-describedby')).toBe('viewer-hint');
  });

  it('put the panel in a 360px column beside a full-height stage on wide screens', () => {
    const css = stylesOf(page('demo/stairs/index.html'));
    const wide = css.slice(css.indexOf('@media (width>=900px)'));
    expect(wide).toMatch(/grid-template-columns:minmax\(0,1fr\) 360px/);
    expect(wide).toMatch(/height:100dvh/);
  });

  it('no longer ship the scroll story', () => {
    const html = page('demo/stairs/index.html');
    expect(html).not.toContain('data-demo-story');
    expect(html).not.toContain('data-camera-toggle');
  });
});

describe('not found page', () => {
  it('emits 404.html for the Workers 404-page handling', () => {
    expect(page('404.html')).toContain('404');
  });

  it('is noindex and has no hreflang alternates', () => {
    const html = page('404.html');
    expect(
      tagsOf(html, 'meta')
        .filter((m) => attr(m, 'name') === 'robots')
        .map((m) => attr(m, 'content')),
    ).toEqual(['noindex']);
    expect(alternates(html)).toEqual({});
  });
});
