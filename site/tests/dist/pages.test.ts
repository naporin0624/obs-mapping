import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { GUIDE_SHOTS, type GuideImage } from '../../src/i18n/guide';
import { ja } from '../../src/i18n/ja';

const GITHUB = 'https://github.com/naporin0624/surface-mapper';
const RELEASES = `${GITHUB}/releases/latest`;
const SKILL_NAMES = ['driving-surface-mapper-over-websocket', 'writing-mapping-json', 'mapping-led-pixel-maps'] as const;
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

// Element source from its opening tag to the matching close tag; enough for the non-nesting tags tested here.
const blocksOf = (html: string, tag: string): string[] => html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'g')) ?? [];
const decode = (text: string): string => text.replaceAll('&#64;', '@').replaceAll('&amp;', '&');

describe('top page', () => {
  it.each(['index.html', 'en/index.html'])('%s offers the latest release as the primary action', (path) => {
    const [primary] = tagsOf(page(path), 'a').filter((a) => attr(a, 'href') === RELEASES);
    expect(primary).toMatch(/class="[^"]*\bbutton\b/);
  });

  it.each(['index.html', 'en/index.html'])('%s lists the Claude Code and skills CLI commands in pre blocks', (path) => {
    const pres = blocksOf(page(path), 'pre').map(decode).join('\n');
    expect(pres).toContain('/plugin marketplace add naporin0624/surface-mapper');
    expect(pres).toContain('/plugin install surface-mapper@surface-mapper');
    for (const skill of SKILL_NAMES) expect(pres).toContain(`npx skills add naporin0624/surface-mapper@${skill}`);
  });

  it.each(['index.html', 'en/index.html'])('%s makes the command blocks keyboard scrollable', (path) => {
    for (const pre of tagsOf(page(path), 'pre')) expect(attr(pre, 'tabindex')).toBe('0');
  });

  it.each(['index.html', 'en/index.html'])('%s links the skills CLI page and the repository', (path) => {
    const links = hrefs(page(path));
    expect(links).toContain('https://skills.sh/naporin0624/surface-mapper');
    expect(links).toContain(GITHUB);
  });

  it('links the demos in the reader language', () => {
    expect(hrefs(page('index.html'))).toContain('/demo/');
    expect(hrefs(page('en/index.html'))).toContain('/en/demo/');
  });
});

// The <section aria-labelledby="id"> element; sections on the top page do not nest.
const sectionById = (html: string, id: string): string => blocksOf(html, 'section').find((s) => new RegExp(`<section\\b[^>]*\\saria-labelledby="${id}"`).test(s)) ?? '';

const GUIDE_PAGES = [
  ['index.html', ja],
  ['en/index.html', en],
] as const;

// Each chunk runs from one marked <li> to the next, so nested lists do not cut it short.
const chunksAt = (html: string, flag: string): string[] => {
  const starts = [...html.matchAll(new RegExp(`<li\\b(?:[^>"']|"[^"]*"|'[^']*')*?\\s${flag}(?:=""|[\\s>])`, 'g'))].map((m) => m.index);
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? html.length));
};
const stepsOf = (section: string): string[] => chunksAt(section, 'data-step');
const rowsOf = (html: string): string[] => chunksAt(html, 'data-guide-row');
const triggersOf = (html: string): string[] => tagsOf(html, 'button').filter((b) => attr(b, 'commandfor') !== undefined);
const guideImageOf = (img: string): GuideImage | undefined => {
  const name = /^\/_astro\/([\w-]+?)\.[\w-]+\.webp$/.exec(attr(img, 'src') ?? '')?.[1];
  return Object.keys(GUIDE_SHOTS).find((key): key is GuideImage => key === name);
};

describe('top page install steps', () => {
  it.each([
    ['index.html', ja],
    ['en/index.html', en],
  ] as const)('%s shows the four install steps in order', (path, copy) => {
    const section = sectionById(page(path), 'install');
    const { download, run, open, connect } = copy.root.install;
    const titles = blocksOf(section, 'h3').map((h) => decode(h.replace(/<[^>]*>/g, '')));
    expect(titles).toEqual([download.title, run.title, open.title, connect.title]);
    expect(stepsOf(section)).toHaveLength(4);
    expect(hrefs(section)).toContain(RELEASES);
    expect(section).toMatch(/\.pkg/);
    expect(section).toMatch(/\.exe/);
    expect(section).toContain('ws://127.0.0.1:4455');
    expect(section).not.toMatch(/<version>|&lt;version&gt;/);
  });

  it.each(['index.html', 'en/index.html'])('%s no longer asks to register a custom browser dock by hand', (path) => {
    expect(sectionById(page(path), 'how')).not.toMatch(/カスタムブラウザドック|custom browser dock/i);
  });

  it.each(['index.html', 'en/index.html'])('%s orders install before how', (path) => {
    const html = page(path);
    expect(html.indexOf('id="install"')).toBeLessThan(html.indexOf('id="how"'));
  });

  it.each(['index.html', 'en/index.html'])('%s states OBS 31.1.1 or later', (path) => {
    expect(sectionById(page(path), 'env')).toContain('31.1.1');
  });

  it.each(['index.html', 'en/index.html'])('%s marks the run step so other sections can link to it', (path) => {
    expect(sectionById(page(path), 'install')).toContain('id="install-run"');
  });
});

describe('top page setup guide', () => {
  it.each(GUIDE_PAGES)('%s shows one screenshot in install step 3 and three in step 4', (path) => {
    const steps = stepsOf(sectionById(page(path), 'install'));
    expect(steps.map((step) => triggersOf(step).length)).toEqual([0, 0, 1, 3]);
  });

  it.each(GUIDE_PAGES)('%s splits how into three steps with 3, 2 and 1 screenshots', (path, copy) => {
    const steps = stepsOf(sectionById(page(path), 'how'));
    const { source, fit, transfer } = copy.root.how;
    expect(steps.map((step) => decode((blocksOf(step, 'h3')[0] ?? '').replace(/<[^>]*>/g, '')))).toEqual([source.title, fit.title, transfer.title]);
    expect(steps.map((step) => triggersOf(step).length)).toEqual([3, 2, 1]);
  });

  it.each(GUIDE_PAGES)('%s keeps the demo link in the fit step', (path) => {
    const [, fit = ''] = stepsOf(sectionById(page(path), 'how'));
    expect(hrefs(fit)).toContain(path === 'index.html' ? '/demo/' : '/en/demo/');
  });

  it.each(GUIDE_PAGES)('%s gives every guide image a non-empty alt and a reserved size', (path) => {
    const imgs = tagsOf(page(path), 'img').filter((img) => guideImageOf(img) !== undefined);
    expect(imgs.length).toBeGreaterThanOrEqual(10);
    for (const img of imgs) {
      expect(attr(img, 'alt')?.trim(), img).toBeTruthy();
      expect(Number(attr(img, 'width'))).toBeGreaterThan(0);
      expect(Number(attr(img, 'height'))).toBeGreaterThan(0);
      expect(attr(img, 'loading')).toBe('lazy');
    }
  });

  it.each(GUIDE_PAGES)('%s lists one item per numbered callout under each screenshot', (path) => {
    const html = page(path);
    const rows = rowsOf(html);
    expect(rows).toHaveLength(Object.keys(GUIDE_SHOTS).length);
    for (const row of rows) {
      const image = guideImageOf(tagsOf(row, 'img')[0] ?? '');
      expect(image).toBeDefined();
      const [list = ''] = blocksOf(row, 'ol');
      expect(blocksOf(list, 'li'), image).toHaveLength(image === undefined ? -1 : GUIDE_SHOTS[image].callouts);
      expect(blocksOf(row, 'h4'), image).toHaveLength(1);
    }
  });

  it.each(GUIDE_PAGES)('%s opens each screenshot in its own modal dialog', (path) => {
    const html = page(path);
    const dialogIds = tagsOf(html, 'dialog').map((d) => attr(d, 'id'));
    const triggers = triggersOf(html);
    expect(triggers).toHaveLength(10);
    for (const trigger of triggers) {
      expect(attr(trigger, 'type')).toBe('button');
      expect(attr(trigger, 'command')).toBe('show-modal');
      expect(dialogIds).toContain(attr(trigger, 'commandfor'));
    }
    expect(new Set(triggers.map((t) => attr(t, 'commandfor'))).size).toBe(10);
  });

  it.each(GUIDE_PAGES)('%s gives the three wide strips a full-width row and keeps the rest side by side', (path) => {
    const layouts = rowsOf(page(path)).map((row) => {
      const [tag = ''] = tagsOf(row, 'li');
      return [guideImageOf(tagsOf(row, 'img')[0] ?? ''), attr(tag, 'data-guide-layout')];
    });
    const wide = new Set(['01-4-dock-connect', '02-3-dock-select-source', '04-1-import-export']);
    expect(layouts).toHaveLength(10);
    for (const [image, layout] of layouts) expect(layout, image).toBe(wide.has(image ?? '') ? 'wide' : 'side');
  });

  it.each(GUIDE_PAGES)('%s alternates the side rows of each step, counting only side rows', (path) => {
    const sides = (html: string): (string | undefined)[] =>
      rowsOf(html)
        .map((row) => tagsOf(row, 'li')[0] ?? '')
        .filter((tag) => attr(tag, 'data-guide-layout') === 'side')
        .map((tag) => attr(tag, 'data-guide-media-side'));
    const steps = [...stepsOf(sectionById(page(path), 'install')), ...stepsOf(sectionById(page(path), 'how'))];
    expect(steps.map(sides)).toEqual([[], [], ['start'], ['start', 'end'], ['start', 'end'], ['start', 'end'], []]);
  });

  it.each(GUIDE_PAGES)('%s lays the rows out in two columns from a 640px container', (path) => {
    const css = stylesOf(page(path));
    expect(css).toMatch(/container-type:inline-size/);
    expect(css).toMatch(/@container \(width>=640px\)/);
    expect(css).not.toMatch(/nth-child\((?:even|2n)\)>\[data-guide-media\]/);
  });
});

const HERO_COPY = {
  'index.html': {
    description: 'ドックで面の四隅をドラッグすると、部屋の角にある 2 面の壁に映像がぴったり合っていく様子',
    pause: '動画を一時停止',
    play: '動画を再生',
  },
  'en/index.html': {
    description: "Dragging a surface's four corners in the dock until the video fits the two walls that meet at a room corner",
    pause: 'Pause video',
    play: 'Play video',
  },
} as const;
const HERO_PAGES = Object.keys(HERO_COPY) as (keyof typeof HERO_COPY)[];
const hasFlag = (tagSource: string, name: string): boolean => new RegExp(`\\s${name}(=""|[\\s>])`).test(tagSource);
const heroVideo = (html: string): string => blocksOf(html, 'video')[0] ?? '';

describe('top page FAQ', () => {
  it.each(['index.html', 'en/index.html'])('%s groups ten questions under four headings', (path) => {
    const section = sectionById(page(path), 'faq');
    expect(blocksOf(section, 'h3')).toHaveLength(4);
    const details = tagsOf(section, 'details');
    expect(details).toHaveLength(10);
    expect(details.map((d) => /\sopen[\s>=]/.test(d))).toEqual([true, true, true, false, false, false, false, false, false, false]);
    expect(blocksOf(section, 'summary')).toHaveLength(10);
  });

  it.each(['index.html', 'en/index.html'])('%s places the FAQ after how and before skills', (path) => {
    const html = page(path);
    expect(html.indexOf('id="how"')).toBeLessThan(html.indexOf('id="faq"'));
    expect(html.indexOf('id="faq"')).toBeLessThan(html.indexOf('id="skills"'));
  });

  it.each(['index.html', 'en/index.html'])('%s links the warning answer to the install step', (path) => {
    expect(hrefs(sectionById(page(path), 'faq'))).toContain('#install-run');
  });

  it.each(['index.html', 'en/index.html'])('%s links the install step to the dock answer', (path) => {
    expect(hrefs(sectionById(page(path), 'install'))).toContain('#faq-dock');
    const details = sectionById(page(path), 'faq').match(/<details[^>]*>[\s\S]*?<\/details>/g) ?? [];
    const owner = details.find((block) => block.includes('id="faq-dock"')) ?? '';
    expect(owner).not.toBe('');
    expect(owner).not.toMatch(/^<details[^>]*id="faq-dock"/);
    expect(owner).not.toMatch(/<summary[^>]*id="faq-dock"/);
  });

  it.each(['index.html', 'en/index.html'])('%s links the README sections by their GitHub anchors', (path) => {
    const links = hrefs(sectionById(page(path), 'faq'));
    expect(links).toContain(`${GITHUB}#macosインストーラー`);
    expect(links).toContain(`${GITHUB}#ドックが出ない場合カスタムブラウザドックに登録する`);
  });
});

const SECTION_IDS = ['can', 'install', 'how', 'faq', 'skills', 'env'] as const;
const tocOf = (html: string, label: string): string[] => blocksOf(html, 'nav').filter((n) => attr(n, 'aria-label') === label);
const textOf = (block: string): string => decode(block.replace(/<[^>]*>/g, '')).trim();
// The nav source from one section link to the next, which holds that section's nested step links.
type SectionId = (typeof SECTION_IDS)[number];
const tocChunk = (nav: string, id: SectionId): string => {
  const start = nav.indexOf(`href="#${id}"`);
  const next = SECTION_IDS.slice(SECTION_IDS.indexOf(id) + 1).map((later) => nav.indexOf(`href="#${later}"`));
  return nav.slice(start, next.find((i) => i > start) ?? nav.length);
};
// The chunk starts inside the section link's own tag, so every <a> found in it is a step link.
const tocSteps = (nav: string, id: SectionId): string[] => blocksOf(tocChunk(nav, id), 'a');

describe('top page table of contents', () => {
  it.each(GUIDE_PAGES)('%s has one contents nav', (path, copy) => {
    expect(tocOf(page(path), copy.root.toc.label)).toHaveLength(1);
  });

  it.each(GUIDE_PAGES)('%s links every section in page order, labelled by its heading', (path, copy) => {
    const [nav = ''] = tocOf(page(path), copy.root.toc.label);
    const sections = blocksOf(nav, 'a').filter((a) => attr(a, 'data-toc-level') === 'section');
    expect(sections.map((a) => attr(a, 'href'))).toEqual(SECTION_IDS.map((id) => `#${id}`));
    const { can, install, how, faq, skills, env } = copy.root;
    expect(sections.map(textOf)).toEqual([can, install, how, faq, skills, env].map((s) => s.heading));
  });

  it.each(GUIDE_PAGES)('%s nests the install and how steps under their sections with short labels', (path, copy) => {
    const [nav = ''] = tocOf(page(path), copy.root.toc.label);
    const { download, run, open, connect } = copy.root.install;
    const { source, fit, transfer } = copy.root.how;
    expect(tocSteps(nav, 'install').map(textOf)).toEqual([download, run, open, connect].map((s) => s.toc));
    expect(tocSteps(nav, 'how').map(textOf)).toEqual([source, fit, transfer].map((s) => s.toc));
    expect(tocChunk(nav, 'install')).toMatch(/<ol\b/);
    for (const id of ['can', 'faq', 'skills', 'env'] as const) expect(tocSteps(nav, id)).toEqual([]);
  });

  it.each(GUIDE_PAGES)('%s points each step link at a step in its own section', (path) => {
    const html = page(path);
    const [nav = ''] = tocOf(html, path === 'index.html' ? ja.root.toc.label : en.root.toc.label);
    for (const id of ['install', 'how'] as const) {
      const stepIds = stepsOf(sectionById(html, id)).map((step) => attr(tagsOf(step, 'li')[0] ?? '', 'id'));
      expect(tocSteps(nav, id).map((a) => attr(a, 'href'))).toEqual(stepIds.map((stepId) => `#${stepId ?? 'missing'}`));
    }
  });

  it.each(GUIDE_PAGES)('%s keeps the existing in-page anchors', (path) => {
    const html = page(path);
    for (const id of [...SECTION_IDS, 'install-run', 'faq-dock']) expect(html).toContain(`id="${id}"`);
    expect(hrefs(sectionById(html, 'faq'))).toContain('#install-run');
  });

  it.each(GUIDE_PAGES)('%s shows the current section in the narrow bar summary', (path, copy) => {
    const [nav = ''] = tocOf(page(path), copy.root.toc.label);
    const [summary = ''] = blocksOf(nav, 'summary');
    expect(textOf(summary)).toContain(copy.root.toc.label);
    expect(summary).toContain('data-toc-current');
  });
});

describe('top page demo video', () => {
  it.each(HERO_PAGES)('%s loops a muted inline video with its size reserved and no autoplay attribute', (path) => {
    const [video = ''] = tagsOf(heroVideo(page(path)), 'video');
    for (const flag of ['muted', 'loop', 'playsinline']) expect(hasFlag(video, flag)).toBe(true);
    expect(video).not.toMatch(/\sautoplay/);
    expect(attr(video, 'preload')).toBe('metadata');
    expect(attr(video, 'poster')).toBe('/videos/mapping-demo-poster.jpg');
    expect(attr(video, 'width')).toBe('1920');
    expect(attr(video, 'height')).toBe('1080');
  });

  it.each(HERO_PAGES)('%s offers webm first, then mp4', (path) => {
    const sources = tagsOf(heroVideo(page(path)), 'source');
    expect(sources.map((s) => [attr(s, 'src'), attr(s, 'type')])).toEqual([
      ['/videos/mapping-demo.webm', 'video/webm'],
      ['/videos/mapping-demo.mp4', 'video/mp4'],
    ]);
  });

  it.each(HERO_PAGES)('%s describes the video and ships a hidden pause button labelled in the page language', (path) => {
    const html = page(path);
    const copy = HERO_COPY[path];
    const [video = ''] = tagsOf(heroVideo(html), 'video');
    expect(attr(video, 'aria-label')).toBe(copy.description);
    const [toggle = ''] = tagsOf(html, 'button').filter((b) => b.includes('data-hero-video-toggle'));
    expect(attr(toggle, 'type')).toBe('button');
    expect(hasFlag(toggle, 'hidden')).toBe(true);
    expect(attr(toggle, 'data-pause')).toBe(copy.pause);
    expect(attr(toggle, 'data-play')).toBe(copy.play);
  });
});

describe('language switcher', () => {
  const switcher = (html: string): string => blocksOf(html, 'details').find((d) => d.includes('hreflang')) ?? '';

  it.each([
    ['index.html', '/', '/en/', 'en'],
    ['en/index.html', '/en/', '/', 'ja'],
    ['demo/stairs/index.html', '/demo/stairs/', '/en/demo/stairs/', 'en'],
  ])('%s marks the current language and links the other', (path, self, other, otherLang) => {
    const links = tagsOf(switcher(page(path)), 'a');
    const current = links.filter((a) => attr(a, 'aria-current') === 'true');
    expect(current.map((a) => attr(a, 'href'))).toEqual([self]);
    const [counterpart] = links.filter((a) => attr(a, 'href') === other);
    expect(counterpart === undefined ? undefined : attr(counterpart, 'hreflang')).toBe(otherLang);
    expect(counterpart === undefined ? undefined : attr(counterpart, 'lang')).toBe(otherLang);
  });

  it('keeps the demo link out of the language navigation', () => {
    const html = page('index.html');
    const language = blocksOf(html, 'nav').filter((n) => attr(n, 'aria-label') === '言語');
    expect(language).toHaveLength(1);
    expect(hrefs(language[0] ?? '')).not.toContain('/demo/');
  });

  it('is left out of the not found page', () => {
    expect(page('404.html')).not.toContain('<details');
  });
});

const metaContent = (html: string, key: 'name' | 'property', value: string): string | undefined => {
  const [meta] = tagsOf(html, 'meta').filter((m) => attr(m, key) === value);
  return meta === undefined ? undefined : attr(meta, 'content');
};
const linksWithRel = (html: string, rel: string): string[] => tagsOf(html, 'link').filter((l) => attr(l, 'rel') === rel);

describe('document head', () => {
  it('preloads both LINE Seed JP weights that the stylesheet declares', () => {
    const html = page('index.html');
    const preloads = linksWithRel(html, 'preload').filter((l) => attr(l, 'as') === 'font');
    const hrefsOf = preloads.map((l) => attr(l, 'href') ?? '');
    expect(hrefsOf).toHaveLength(2);
    for (const l of preloads) {
      expect(attr(l, 'type')).toBe('font/woff2');
      expect(l).toMatch(/\scrossorigin[\s>=]/);
    }
    const faces = stylesOf(html).match(/@font-face\{[^}]*\}/g) ?? [];
    for (const weight of ['400', '700']) {
      const face = faces.find((f) => f.includes(`font-weight:${weight}`)) ?? '';
      expect(face).toContain('font-display:swap');
      const [, url] = /url\(([^)]+)\)/.exec(face) ?? [];
      expect(hrefsOf).toContain(url);
    }
  });

  it('ships the font subsets as woff2', () => {
    const html = page('index.html');
    for (const l of linksWithRel(html, 'preload')) {
      const bytes = readFileSync(fileURLToPath(new URL(`../../dist${attr(l, 'href') ?? ''}`, import.meta.url)));
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
    }
  });

  it('links a 32px favicon and a 180px apple touch icon', () => {
    const html = page('index.html');
    const [favicon] = linksWithRel(html, 'icon');
    const [touch] = linksWithRel(html, 'apple-touch-icon');
    expect(favicon === undefined ? undefined : attr(favicon, 'sizes')).toBe('32x32');
    expect(favicon === undefined ? undefined : attr(favicon, 'href')).toMatch(/^\/_astro\/icon\.[\w-]+\.png$/);
    expect(touch === undefined ? undefined : attr(touch, 'sizes')).toBe('180x180');
  });

  it.each([
    ['index.html', 'https://surface-mapper.napochaan.dev/', 'ja_JP'],
    ['en/index.html', 'https://surface-mapper.napochaan.dev/en/', 'en_US'],
    ['en/demo/stairs/index.html', 'https://surface-mapper.napochaan.dev/en/demo/stairs/', 'en_US'],
  ])('%s carries Open Graph and Twitter card tags', (path, url, locale) => {
    const html = page(path);
    expect(metaContent(html, 'property', 'og:url')).toBe(url);
    expect(metaContent(html, 'property', 'og:locale')).toBe(locale);
    expect(metaContent(html, 'property', 'og:type')).toBe('website');
    expect(metaContent(html, 'property', 'og:title')).not.toBe('');
    expect(metaContent(html, 'property', 'og:description')).not.toBe('');
    expect(metaContent(html, 'property', 'og:image')).toMatch(/^https:\/\/surface-mapper\.napochaan\.dev\/_astro\/mapping-demo\.[\w-]+\.jpg$/);
    expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
  });

  it('shows the logo beside the site name without announcing it twice', () => {
    const [logo] = tagsOf(page('index.html'), 'img').filter((img) => (attr(img, 'src') ?? '').startsWith('/_astro/icon.'));
    expect(logo).toMatch(/\salt(=""|[\s>])/);
    expect(logo === undefined ? undefined : attr(logo, 'width')).toBe('28');
  });
});

describe('product name', () => {
  const htmlFiles = readdirSync(fileURLToPath(new URL('../../dist/', import.meta.url)), { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.html'));

  it.each(['index.html', 'en/index.html', 'demo/index.html', 'en/demo/stairs/index.html', '404.html'])('%s names Surface Mapper in its title', (path) => {
    const [title] = blocksOf(page(path), 'title');
    expect(title).toContain('Surface Mapper');
  });

  it('never shows the old product name or identifier', () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
    for (const f of htmlFiles) expect(page(f), f).not.toMatch(/obs[-_ ]?mapping/i);
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

describe('top page backdrop', () => {
  const backdrop = (html: string): string => /<div\b[^>]*data-page-backdrop[^>]*>[\s\S]*?<\/picture>/.exec(html)?.[0] ?? '';

  it.each([
    ['ja', 'index.html'],
    ['en', 'en/index.html'],
  ])('%s top page holds a decorative backdrop picture', (_lang, path) => {
    const block = backdrop(page(path));
    expect(block).toContain('aria-hidden="true"');
    // Astro serialises an empty alt as the bare attribute.
    expect(tagsOf(block, 'img').map((img) => /\salt(?:="")?(?=[\s>])/.test(img))).toEqual([true]);
    expect(block).toMatch(/type="image\/avif"/);
    expect(block).toMatch(/type="image\/webp"/);
  });

  it('demo index has no backdrop', () => {
    expect(page('demo/index.html')).not.toContain('data-page-backdrop');
    expect(page('en/demo/index.html')).not.toContain('data-page-backdrop');
  });
});
