import { describe, expect, it } from 'vitest';
import { en as dockEn } from '../../../ui/src/i18n/messages/en';
import { ja as dockJa } from '../../../ui/src/i18n/messages/ja';
import { DEMO_SOURCE, type DemoSlug, type StepId } from '../scene/spec';
import { GUIDE_SHOTS, type GuideRow } from './guide';
import { localePath, messagesFor, SKILLS, type Lang } from './messages';

const docks = { ja: dockJa, en: dockEn } as const;
const langs: readonly Lang[] = ['ja', 'en'];
const steps: Record<DemoSlug, readonly StepId[]> = {
  stairs: ['place', 'fit', 'done'],
  hexagon: ['place', 'fit', 'shape', 'done'],
  drums: ['place', 'fit', 'shape', 'done'],
  cubes: ['place', 'fit', 'shape', 'done'],
};
const demos = Object.keys(steps) as DemoSlug[];

const keyPaths = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix === '' ? k : `${prefix}.${k}`)) : [prefix];

describe('messagesFor', () => {
  it('has the same keys in ja and en', () => {
    expect(Object.keys(messagesFor('en')).toSorted()).toEqual(Object.keys(messagesFor('ja')).toSorted());
  });

  it.each(langs)('%s: every step of every demo has a non-empty title and body', (lang) => {
    const m = messagesFor(lang);
    for (const slug of demos) {
      for (const id of steps[slug]) {
        const step = m.step(slug, id);
        expect(step.title).not.toBe('');
        expect(step.body).not.toBe('');
      }
    }
  });

  it.each(langs)('%s: place names the camera source', (lang) => {
    const m = messagesFor(lang);
    for (const slug of demos) expect(m.step(slug, 'place').body).toContain(DEMO_SOURCE);
  });

  it.each(langs)('%s: fit uses the dock add and source labels', (lang) => {
    const m = messagesFor(lang);
    for (const slug of demos) {
      const body = m.step(slug, 'fit').body;
      expect(body).toContain(docks[lang].add);
      expect(body).toContain(docks[lang].source);
    }
  });

  it.each(langs)('%s: shape uses the dock mask labels', (lang) => {
    const m = messagesFor(lang);
    const dock = docks[lang];
    const hexagon = m.step('hexagon', 'shape').body;
    const drums = m.step('drums', 'shape').body;
    for (const body of [hexagon, drums]) {
      expect(body).toContain(dock.maskHeading);
      expect(body).toContain(dock.maskEdit);
    }
    expect(hexagon).toContain(dock.maskPolygon);
    expect(drums).toContain(dock.maskEllipse);
  });

  it.each(langs)('%s: cubes shape cuts holes with the polygon mask', (lang) => {
    const dock = docks[lang];
    const body = messagesFor(lang).step('cubes', 'shape').body;
    for (const label of [dock.maskHeading, dock.maskPolygon, dock.maskEdit]) expect(body).toContain(label);
    expect(body).toContain(lang === 'ja' ? '穴' : 'hole');
  });

  it.each(langs)('%s: every demo has a title and description', (lang) => {
    for (const slug of demos) {
      expect(messagesFor(lang).demos[slug].title).not.toBe('');
      expect(messagesFor(lang).demos[slug].description).not.toBe('');
    }
  });

  it.each(langs)('%s: done uses the dock import label', (lang) => {
    const m = messagesFor(lang);
    for (const slug of demos) expect(m.step(slug, 'done').body).toContain(docks[lang].importButton);
  });

  it.each(langs)('%s: the download note names the camera source', (lang) => {
    expect(messagesFor(lang).download.note).toContain(DEMO_SOURCE);
  });

  it('ja: the download note joins the import label without a stray space', () => {
    expect(messagesFor('ja').download.note).toContain(`にしてから${dockJa.importButton}`);
  });

  it.each(langs)('%s: has a distinct message for a camera held by another app', (lang) => {
    const { camera } = messagesFor(lang);
    expect(camera.busy).toContain('OBS');
    expect(camera.busy).not.toBe(camera.unavailable);
  });

  it('has the same viewer and camera keys in ja and en', () => {
    const keys = (lang: Lang): string[] => {
      const { viewer, camera } = messagesFor(lang);
      return [...Object.entries(viewer).flatMap(([k, v]) => (typeof v === 'string' ? [k] : Object.keys(v).map((sub) => `${k}.${sub}`))), ...Object.keys(camera)].toSorted();
    };
    expect(keys('en')).toEqual(keys('ja'));
  });

  it('runs Japanese status sentences together and separates English ones with a space', () => {
    expect(messagesFor('ja').camera.join).toBe('');
    expect(messagesFor('en').camera.join).toBe(' ');
  });

  it.each(langs)('%s: names the camera that opened instead of OBS through a {label} slot', (lang) => {
    expect(messagesFor(lang).camera.other).toContain('{label}');
  });

  it.each(langs)('%s: the OBS steps use the dock import label', (lang) => {
    expect(messagesFor(lang).viewer.connect.importIt).toContain(docks[lang].importButton);
  });

  it.each(langs)('%s: the input offers the OBS Virtual Camera by name', (lang) => {
    expect(messagesFor(lang).viewer.input.obs).toContain('OBS');
  });

  it.each(langs)('%s: labels the sample play and pause control', (lang) => {
    const { sample } = messagesFor(lang);
    expect(sample.pause).not.toBe('');
    expect(sample.play).not.toBe(sample.pause);
  });
});

const guideRows = (lang: Lang): readonly GuideRow[] => {
  const { install, how } = messagesFor(lang).root;
  return [install.open, install.connect, how.source, how.fit, how.transfer].flatMap((step) => step.rows);
};
const rowText = (rows: readonly GuideRow[]): string => rows.flatMap((row) => [row.where, row.title, ...row.items]).join('\n');

describe('root page copy', () => {
  it('has the same root keys in ja and en', () => {
    expect(keyPaths(messagesFor('en').root).toSorted()).toEqual(keyPaths(messagesFor('ja').root).toSorted());
  });

  it.each(langs)('%s: lists as many features in each language', (lang) => {
    expect(messagesFor(lang).root.can.items).toHaveLength(messagesFor('ja').root.can.items.length);
    for (const item of messagesFor(lang).root.can.items) expect(item).not.toBe('');
  });

  it.each(langs)('%s: the connect step names the dock connect and connected labels', (lang) => {
    const text = rowText(messagesFor(lang).root.install.connect.rows);
    expect(text).toContain(docks[lang].connectConnect);
    expect(text).toContain(docks[lang].connectOpen);
  });

  it.each(langs)('%s: the source step names the dock source and reload labels', (lang) => {
    const text = rowText(messagesFor(lang).root.how.source.rows);
    for (const label of [docks[lang].source, docks[lang].sourceReload]) expect(text).toContain(label);
  });

  it.each(langs)('%s: the fit step names the dock add, layers, crop and shape labels', (lang) => {
    const { fit } = messagesFor(lang).root.how;
    const text = `${rowText(fit.rows)}\n${fit.mask}`;
    for (const label of [docks[lang].add, docks[lang].layersHeading, docks[lang].cropHeading, docks[lang].maskHeading]) expect(text).toContain(label);
  });

  it.each(langs)('%s: the transfer step names import, export and both resolution choices', (lang) => {
    const text = rowText(messagesFor(lang).root.how.transfer.rows);
    const dock = docks[lang];
    for (const label of [dock.importButton, dock.exportButton, dock.importScale, dock.importOverwrite]) expect(text).toContain(label);
  });

  it.each(langs)('%s: every guide row explains each numbered callout of its screenshot', (lang) => {
    for (const row of guideRows(lang)) {
      expect(row.items, row.image).toHaveLength(GUIDE_SHOTS[row.image].callouts);
      for (const text of [row.alt, row.where, row.title, ...row.items]) expect(text.trim(), row.image).not.toBe('');
    }
  });

  it.each(langs)('%s: shows every guide screenshot once, in file order', (lang) => {
    expect(guideRows(lang).map((row) => row.image)).toEqual(Object.keys(GUIDE_SHOTS));
  });

  it.each(langs)('%s: the download step names both installer extensions', (lang) => {
    const { body } = messagesFor(lang).root.install.download;
    for (const ext of ['.pkg', '.exe']) expect(body).toContain(ext);
  });

  it.each(langs)('%s: the connect step keeps the default URL', (lang) => {
    expect(rowText(messagesFor(lang).root.install.connect.rows)).toContain('ws://127.0.0.1:4455');
  });

  it.each(langs)('%s: describes every published skill', (lang) => {
    const { list } = messagesFor(lang).root.skills;
    expect(Object.keys(list).toSorted()).toEqual([...SKILLS].toSorted());
    for (const skill of SKILLS) expect(list[skill]).not.toBe('');
  });

  it('names the three skills once each', () => {
    expect(new Set(SKILLS).size).toBe(3);
  });
});

describe('localePath', () => {
  it('prefixes en and leaves ja untouched', () => {
    expect(localePath('en', '/demo/stairs')).toBe('/en/demo/stairs');
    expect(localePath('ja', '/demo/stairs')).toBe('/demo/stairs');
  });

  it('maps the root', () => {
    expect(localePath('en', '/')).toBe('/en/');
    expect(localePath('ja', '/')).toBe('/');
  });
});
