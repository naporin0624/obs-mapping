// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider, useAtomValue } from 'jotai';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lifecycleAtom } from '../../atoms/lifecycle';
import { selectSourceAtom } from '../../atoms/session';
import { toastAtom } from '../../atoms/toast';
import { underlayDepsAtom } from '../../atoms/underlay';
import { fakeObs, mapping } from '../../test/fake-obs';
import { buildStore } from '../../test/store-harness';
import { createMemoryUnderlayStore } from '../../underlay/memory-store';
import type { UnderlayStore } from '../../underlay/store';
import { Editor } from '../editor';

const Mounted = () => {
  useAtomValue(lifecycleAtom);
  return <Editor />;
};

const png = (name = 'floor.png'): File => new File(['x'], name, { type: 'image/png' });

const renderEditor = async (underlayStore: UnderlayStore = createMemoryUnderlayStore(), strict = false) => {
  const obs = fakeObs(mapping(10));
  const { store } = buildStore(obs);
  const createUrl = vi.fn((): string => `blob:${String(createUrl.mock.calls.length)}`);
  const revokeUrl = vi.fn();
  store.set(underlayDepsAtom, { store: underlayStore, createUrl, revokeUrl });
  const tree = (
    <Provider store={store}>
      <Mounted />
    </Provider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  await act(() => vi.advanceTimersByTimeAsync(0));
  await act(async () => {
    store.set(selectSourceAtom, 'Map');
    await vi.advanceTimersByTimeAsync(0);
  });
  return { store, underlayStore, revokeUrl, createUrl, obs };
};

const choose = async (file = png()): Promise<void> => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('下地画像ファイル'), { target: { files: [file] } });
    await vi.advanceTimersByTimeAsync(0);
  });
};

const underlayImage = (): HTMLImageElement | null => screen.queryByAltText('下地画像');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('underlay controls before and after choosing', () => {
  it('shows only the image chooser before an image is chosen', async () => {
    await renderEditor();
    expect(screen.getByRole('button', { name: '画像…' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '下地を表示' })).toBeNull();
    expect(screen.queryByRole('slider', { name: '濃さ' })).toBeNull();
    expect(screen.queryByRole('button', { name: '下地を削除' })).toBeNull();
    expect(underlayImage()).toBeNull();
  });

  it('accepts image files only', async () => {
    await renderEditor();
    expect(screen.getByLabelText('下地画像ファイル').getAttribute('accept')).toBe('image/*');
  });

  it('choosing a file draws the underlay at the default opacity and reveals the controls', async () => {
    await renderEditor();
    await choose();
    expect(underlayImage()?.getAttribute('src')).toBe('blob:1');
    expect(underlayImage()?.style.opacity).toBe('0.6');
    expect(screen.getByRole('button', { name: '下地を表示' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('slider', { name: '濃さ' }).getAttribute('aria-valuetext')).toBe('60%');
    expect(screen.getByRole('button', { name: '下地を削除' })).toBeTruthy();
  });
});

describe('underlay controls editing and persistence', () => {
  it('toggle hides the underlay and opacity changes it, both persisted', async () => {
    const { underlayStore } = await renderEditor();
    await choose();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('slider', { name: '濃さ' }), { key: 'ArrowLeft' });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(underlayImage()?.style.opacity).toBe('0.59');
    expect(screen.getByRole('slider', { name: '濃さ' }).getAttribute('aria-valuetext')).toBe('59%');
    expect((await underlayStore.load('Map'))?.opacity).toBe(0.59);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下地を表示' }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(underlayImage()).toBeNull();
    expect((await underlayStore.load('Map'))?.visible).toBe(false);
  });

  it('remove clears the underlay, hides the controls and deletes the stored data', async () => {
    const { underlayStore, revokeUrl } = await renderEditor();
    await choose();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下地を削除' }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(underlayImage()).toBeNull();
    expect(screen.queryByRole('slider', { name: '濃さ' })).toBeNull();
    expect(await underlayStore.load('Map')).toBeNull();
    expect(revokeUrl.mock.calls).toEqual([['blob:1']]);
  });
});

describe('underlay controls per source and on failure', () => {
  it('loads the stored underlay for a source on open and swaps it when the source changes', async () => {
    const stored = createMemoryUnderlayStore();
    await stored.saveImage('Map', { blob: new Blob(['m']), visible: true, opacity: 0.4 });
    const { store } = await renderEditor(stored);
    expect(underlayImage()).not.toBeNull();
    expect(screen.getByRole('slider', { name: '濃さ' }).getAttribute('aria-valuetext')).toBe('40%');
    await act(async () => {
      store.set(selectSourceAtom, 'Other');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(underlayImage()).toBeNull();
    expect(screen.queryByRole('slider', { name: '濃さ' })).toBeNull();
  });

  it('keeps the session working and shows a toast when storage fails', async () => {
    const broken: UnderlayStore = {
      load: async () => null,
      saveImage: async () => {
        throw new Error('quota');
      },
      saveSettings: async () => undefined,
      remove: async () => undefined,
    };
    const { store } = await renderEditor(broken);
    await choose();
    expect(underlayImage()).not.toBeNull();
    expect(store.get(toastAtom)?.text).toMatch(/下地画像を保存できませんでした/);
  });
});

describe('underlay controls lifecycle and isolation', () => {
  it('loads the stored underlay once under StrictMode', async () => {
    const stored = createMemoryUnderlayStore();
    await stored.saveImage('Map', { blob: new Blob(['m']), visible: true, opacity: 0.4 });
    const { createUrl, revokeUrl } = await renderEditor(stored, true);
    expect(underlayImage()).not.toBeNull();
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).not.toHaveBeenCalled();
  });

  it('never sends anything to the plugin while the underlay is edited', async () => {
    const { obs } = await renderEditor();
    await choose();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下地を表示' }));
      fireEvent.click(screen.getByRole('button', { name: '下地を削除' }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(obs.setMapping).not.toHaveBeenCalled();
    expect(obs.getMapping).toHaveBeenCalledTimes(1);
  });

  it('does not show a finished save on another source', async () => {
    const gate = Promise.withResolvers<void>();
    const memory = createMemoryUnderlayStore();
    const slow: UnderlayStore = {
      ...memory,
      saveImage: async (source, value) => {
        await gate.promise;
        return memory.saveImage(source, value);
      },
    };
    const { store } = await renderEditor(slow);
    await choose();
    await act(async () => {
      store.set(selectSourceAtom, 'Other');
      await vi.advanceTimersByTimeAsync(0);
    });
    gate.resolve();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(underlayImage()).toBeNull();
    expect(await memory.load('Map')).not.toBeNull();
  });
});
