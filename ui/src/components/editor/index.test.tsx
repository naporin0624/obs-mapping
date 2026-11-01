// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeObs, mapping, type FakeObs } from '../../test/fake-obs';
import { dispatchAtom } from '../../atoms/mapping';
import { toastAtom } from '../../atoms/toast';
import { lifecycleAtom } from '../../atoms/lifecycle';
import { selectSourceAtom } from '../../atoms/session';
import { buildStore } from '../../test/store-harness';
import { useAtomValue } from 'jotai';
import { Editor } from '.';

const Mounted = () => {
  useAtomValue(lifecycleAtom);
  return <Editor />;
};

const renderEditor = async (obs: FakeObs, strict = false) => {
  const { store, instances } = buildStore(obs);
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
  return Object.assign(store, { instances });
};

const useEnvironment = (): void => {
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
};

describe('Editor first load', () => {
  useEnvironment();

  it('shows the Suspense fallback on the first load, then the editor', async () => {
    const obs = fakeObs(mapping(10));
    const release = Promise.withResolvers<void>();
    const reply = { ok: true, mapping: mapping(10), overlayEnabled: false } as const;
    obs.getMapping.mockImplementation(async () => {
      await release.promise;
      return reply;
    });
    await renderEditor(obs);
    expect(screen.getByText('Loading mapping…')).toBeTruthy();
    release.resolve();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.queryByText('Loading mapping…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('shows the error with Retry when the load fails and recovers on retry', async () => {
    const obs = fakeObs(mapping(10));
    obs.getMapping.mockResolvedValueOnce({ ok: false, error: 'plugin down' });
    await renderEditor(obs);
    expect(screen.getByText(/読み込みに失敗しました: plugin down/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });
});

describe('Editor later edits', () => {
  useEnvironment();

  it('never shows the fallback again on later edits', async () => {
    const obs = fakeObs(mapping(10));
    const store = await renderEditor(obs);
    const undo = (): HTMLButtonElement => screen.getByRole('button', { name: 'Undo' });
    expect(undo().disabled).toBe(true);
    await act(async () => {
      store.set(dispatchAtom, { type: 'setGrid', size: 20 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText('Loading mapping…')).toBeNull();
    expect(undo().disabled).toBe(false);
  });
});

describe('Editor reconnect and source switch', () => {
  useEnvironment();

  it('recovers from a failed load after a reconnect without clicking Retry', async () => {
    const obs = fakeObs(mapping(10));
    obs.getMapping.mockResolvedValueOnce({ ok: false, error: 'socket closed' });
    await renderEditor(obs);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    await act(async () => {
      obs.dropSocket();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/OBS に接続すると/)).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(obs.getMapping).toHaveBeenCalledTimes(2);
  });

  it('drops the previous source error when another source is selected', async () => {
    const obs = fakeObs(mapping(10));
    const ok = { ok: true, mapping: mapping(10), overlayEnabled: false } as const;
    obs.getMapping.mockImplementation(async (name: string) => (name === 'B' ? ({ ok: false, error: 'B is broken' } as const) : ok));
    const store = await renderEditor(obs);
    await act(async () => {
      store.set(selectSourceAtom, 'B');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/B is broken/)).toBeTruthy();
    await act(async () => {
      store.set(selectSourceAtom, 'A');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText(/B is broken/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('reports a load error to the toast exactly once', async () => {
    const obs = fakeObs(mapping(10));
    obs.getMapping.mockResolvedValueOnce({ ok: false, error: 'plugin down' });
    const store = await renderEditor(obs);
    expect(store.get(toastAtom)).toEqual({ id: 1, text: 'plugin down' });
  });
});

describe('Editor under StrictMode', () => {
  useEnvironment();

  it('opens the source once and loads it once', async () => {
    const obs = fakeObs(mapping(10));
    const store = await renderEditor(obs, true);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(obs.getMapping).toHaveBeenCalledTimes(1);
    expect(store.instances.sync.getState().source).toBe('Map');
  });
});
