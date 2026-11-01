import { createStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryUnderlayStore } from '../../underlay/memory-store';
import type { UnderlayStore } from '../../underlay/store';
import { toastAtom } from '../toast';
import { chooseUnderlayAtom, commitUnderlayOpacityAtom, loadUnderlayAtom, removeUnderlayAtom, setUnderlayOpacityAtom, toggleUnderlayAtom, underlayAtom, underlayDepsAtom } from '.';

const png = (name = 'a.png'): File => new File(['x'], name, { type: 'image/png' });

const build = (store: UnderlayStore = createMemoryUnderlayStore()) => {
  const createUrl = vi.fn((): string => `blob:${String(createUrl.mock.calls.length)}`);
  const revokeUrl = vi.fn();
  const jotai = createStore();
  jotai.set(underlayDepsAtom, { store, createUrl, revokeUrl });
  return { jotai, store, createUrl, revokeUrl };
};

const failing = (): UnderlayStore => ({
  load: vi.fn(async () => {
    throw new Error('read');
  }),
  saveImage: vi.fn(async () => {
    throw new Error('write');
  }),
  saveSettings: vi.fn(async () => {
    throw new Error('write');
  }),
  remove: vi.fn(async () => {
    throw new Error('delete');
  }),
});

describe('underlay atoms', () => {
  it('starts empty', () => {
    const { jotai } = build();
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: null });
  });

  it('choosing a file shows it with the defaults and stores it', async () => {
    const { jotai, store } = build();
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    expect(jotai.get(underlayAtom)).toMatchObject({ kind: 'image', source: 'Map', url: 'blob:1', visible: true, opacity: 0.6 });
    expect((await store.load('Map'))?.opacity).toBe(0.6);
  });

  it('revokes the previous url when the image is replaced', async () => {
    const { jotai, revokeUrl } = build();
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    await jotai.set(chooseUnderlayAtom, 'Map', png('b.png'));
    expect(revokeUrl.mock.calls).toEqual([['blob:1']]);
  });

  it('toggle and a committed opacity change the state and persist it', async () => {
    const { jotai, store } = build();
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    jotai.set(setUnderlayOpacityAtom, 0.3);
    await jotai.set(commitUnderlayOpacityAtom, 0.25);
    await jotai.set(toggleUnderlayAtom);
    expect(jotai.get(underlayAtom)).toMatchObject({ visible: false, opacity: 0.25 });
    expect(await store.load('Map')).toMatchObject({ visible: false, opacity: 0.25 });
  });

  it('settings changes never write the image again', async () => {
    const memory = createMemoryUnderlayStore();
    const saveImage = vi.spyOn(memory, 'saveImage');
    const saveSettings = vi.spyOn(memory, 'saveSettings');
    const { jotai } = build(memory);
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    await jotai.set(toggleUnderlayAtom);
    await jotai.set(commitUnderlayOpacityAtom, 0.1);
    expect(saveImage).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledTimes(2);
  });

  it('remove clears the state, revokes the url and deletes the stored data', async () => {
    const { jotai, store, revokeUrl } = build();
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    await jotai.set(removeUnderlayAtom);
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: 'Map' });
    expect(revokeUrl.mock.calls).toEqual([['blob:1']]);
    expect(await store.load('Map')).toBeNull();
  });
});

describe('underlay atoms across sources', () => {
  it('loading another source swaps the underlay and revokes the old url', async () => {
    const { jotai, store, revokeUrl } = build();
    await store.saveImage('B', { blob: new Blob(['b']), visible: false, opacity: 0.9 });
    await jotai.set(chooseUnderlayAtom, 'A', png());
    await jotai.set(loadUnderlayAtom, 'B');
    expect(jotai.get(underlayAtom)).toMatchObject({ kind: 'image', source: 'B', visible: false, opacity: 0.9 });
    expect(revokeUrl.mock.calls).toEqual([['blob:1']]);
    await jotai.set(loadUnderlayAtom, 'C');
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: 'C' });
  });

  it('loading no source releases the url', async () => {
    const { jotai, revokeUrl } = build();
    await jotai.set(chooseUnderlayAtom, 'A', png());
    await jotai.set(loadUnderlayAtom, null);
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: null });
    expect(revokeUrl.mock.calls).toEqual([['blob:1']]);
  });

  it('reloading the source already showing keeps the in-session image', async () => {
    const { jotai, createUrl } = build();
    await jotai.set(chooseUnderlayAtom, 'A', png());
    await jotai.set(loadUnderlayAtom, 'A');
    expect(jotai.get(underlayAtom)).toMatchObject({ kind: 'image', source: 'A', url: 'blob:1' });
    expect(createUrl).toHaveBeenCalledTimes(1);
  });
});

describe('underlay atoms racing the store', () => {
  const slowLoad = (source: string) => {
    const memory = createMemoryUnderlayStore();
    const gate = Promise.withResolvers<void>();
    const store: UnderlayStore = {
      ...memory,
      load: async (s) => {
        if (s === source) await gate.promise;
        return memory.load(s);
      },
    };
    return { memory, store, release: () => gate.resolve() };
  };

  it('ignores a slow load that a newer load has overtaken', async () => {
    const { memory, store, release } = slowLoad('A');
    await memory.saveImage('A', { blob: new Blob(['a']), visible: true, opacity: 0.1 });
    const { jotai } = build(store);
    const first = jotai.set(loadUnderlayAtom, 'A');
    await jotai.set(loadUnderlayAtom, 'B');
    release();
    await first;
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: 'B' });
  });

  it('ignores a slow load that a choose for the same source has overtaken', async () => {
    const { memory, store, release } = slowLoad('A');
    await memory.saveImage('A', { blob: new Blob(['old']), visible: true, opacity: 0.1 });
    const { jotai } = build(store);
    const pending = jotai.set(loadUnderlayAtom, 'A');
    await jotai.set(chooseUnderlayAtom, 'A', png('new.png'));
    release();
    await pending;
    expect(jotai.get(underlayAtom)).toMatchObject({ kind: 'image', opacity: 0.6, url: 'blob:1' });
  });

  it('ignores a slow load that a remove has overtaken', async () => {
    const { memory, store, release } = slowLoad('A');
    await memory.saveImage('A', { blob: new Blob(['old']), visible: true, opacity: 0.1 });
    const { jotai } = build(store);
    const pending = jotai.set(loadUnderlayAtom, 'A');
    await jotai.set(removeUnderlayAtom);
    release();
    await pending;
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: 'A' });
  });

  it('leaves another source alone when a save finishes after the switch', async () => {
    const gate = Promise.withResolvers<void>();
    const memory = createMemoryUnderlayStore();
    const store: UnderlayStore = {
      ...memory,
      saveImage: async (s, v) => {
        await gate.promise;
        return memory.saveImage(s, v);
      },
    };
    const { jotai } = build(store);
    const saving = jotai.set(chooseUnderlayAtom, 'A', png());
    await jotai.set(loadUnderlayAtom, 'B');
    gate.resolve();
    await saving;
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: 'B' });
    expect(await memory.load('A')).not.toBeNull();
  });
});

describe('underlay atoms when things fail', () => {
  it('keeps working in-session and toasts when storage fails', async () => {
    const { jotai } = build(failing());
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    expect(jotai.get(underlayAtom)).toMatchObject({ kind: 'image', source: 'Map' });
    expect(jotai.get(toastAtom)?.text).toMatch(/下地画像を保存できませんでした/);
    await jotai.set(loadUnderlayAtom, 'Other');
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: 'Other' });
    expect(jotai.get(toastAtom)?.text).toMatch(/下地画像を読み込めませんでした/);
  });

  it('toasts when saving settings fails but keeps the new settings in-session', async () => {
    const { jotai } = build(failing());
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    await jotai.set(toggleUnderlayAtom);
    expect(jotai.get(underlayAtom)).toMatchObject({ visible: false });
    expect(jotai.get(toastAtom)?.text).toMatch(/設定を保存できませんでした/);
  });

  it('toasts instead of throwing when the object url cannot be created', async () => {
    const { jotai, createUrl } = build();
    createUrl.mockImplementation(() => {
      throw new Error('no url');
    });
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    expect(jotai.get(underlayAtom)).toEqual({ kind: 'none', source: 'Map' });
    expect(jotai.get(toastAtom)?.text).toMatch(/下地画像を表示できませんでした/);
  });

  it('toasts instead of throwing when the store cannot be built', async () => {
    const jotai = createStore();
    jotai.set(underlayDepsAtom, {
      get store(): UnderlayStore {
        throw new ReferenceError('indexedDB is not defined');
      },
      createUrl: () => 'blob:1',
      revokeUrl: () => undefined,
    });
    await jotai.set(chooseUnderlayAtom, 'Map', png());
    expect(jotai.get(underlayAtom)).toMatchObject({ kind: 'image' });
    expect(jotai.get(toastAtom)?.text).toMatch(/下地画像を保存できませんでした/);
  });
});
