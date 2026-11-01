// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mapping } from '../model/mapping';
import type { ObsClient, VendorResult } from '../obs/client';
import { useSync } from './use-sync';

const mapping = (grid: number): Mapping => ({ version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: grid }, surfaces: [] });

type Fake = {
  client: ObsClient;
  getMapping: ReturnType<typeof vi.fn>;
  setMapping: ReturnType<typeof vi.fn>;
  emit: (m: Mapping) => void;
  plugin: { mapping: Mapping };
};

const fake = (initial: Mapping): Fake => {
  const plugin = { mapping: initial };
  let listener: ((name: string, m: Mapping) => void) | null = null;
  const getMapping = vi.fn(async () => ({ ok: true, mapping: plugin.mapping }) as VendorResult<{ mapping: Mapping }>);
  const setMapping = vi.fn(async (_n: string, m: Mapping) => {
    plugin.mapping = m;
    return { ok: true } as VendorResult<{}>;
  });
  const client: ObsClient = {
    listMappingSources: async () => ({ ok: true, sources: [] }),
    getMapping,
    setMapping,
    setOverlay: async () => ({ ok: true }),
    screenshot: async () => '',
    listInputs: async () => [],
    onMappingChanged: (cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
  };
  return { client, getMapping, setMapping, plugin, emit: (m) => listener?.('Map', m) };
};

const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const mount = async (f: Fake, online = true) => {
  const hook = renderHook(({ on }) => useSync(f.client, 'Map', on), { initialProps: { on: online } });
  await settle();
  return hook;
};

describe('useSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('loads the mapping when online and sends a local edit once', async () => {
    const f = fake(mapping(10));
    const { result } = await mount(f);
    expect(result.current.loaded).toBe(true);
    expect(f.setMapping).not.toHaveBeenCalled();
    act(() => result.current.dispatch({ type: 'setGrid', size: 20 }));
    await settle();
    expect(f.setMapping).toHaveBeenCalledTimes(1);
    expect(f.setMapping.mock.calls[0]?.[1].grid.size).toBe(20);
  });

  it('does not send back its own echo or a plugin-originated change', async () => {
    const f = fake(mapping(10));
    const { result } = await mount(f);
    act(() => result.current.dispatch({ type: 'setGrid', size: 20 }));
    await settle();
    act(() => f.emit(mapping(20))); // echo of our own send
    await settle();
    act(() => f.emit(mapping(30))); // someone else's change
    await settle();
    expect(result.current.state.mapping.grid.size).toBe(30);
    expect(f.setMapping).toHaveBeenCalledTimes(1);
  });

  it('resends an unsent local change on reconnect instead of reloading', async () => {
    const f = fake(mapping(10));
    const { result, rerender } = await mount(f);
    rerender({ on: false });
    act(() => result.current.dispatch({ type: 'setGrid', size: 20 }));
    await settle();
    expect(f.setMapping).not.toHaveBeenCalled();
    rerender({ on: true });
    await settle();
    expect(f.setMapping).toHaveBeenCalledTimes(1);
    expect(f.setMapping.mock.calls[0]?.[1].grid.size).toBe(20);
    expect(f.getMapping).toHaveBeenCalledTimes(1);
    expect(result.current.state.mapping.grid.size).toBe(20);
  });

  it('keeps an edit whose send failed in transport while still online and resends it on reconnect', async () => {
    const f = fake(mapping(10));
    const { result, rerender } = await mount(f);
    f.setMapping.mockResolvedValueOnce({ ok: false, error: 'Not connected', transport: true });
    act(() => result.current.dispatch({ type: 'setGrid', size: 20 }));
    await settle();
    expect(f.setMapping).toHaveBeenCalledTimes(1);
    rerender({ on: false });
    rerender({ on: true });
    await settle();
    expect(f.setMapping).toHaveBeenCalledTimes(2);
    expect(f.setMapping.mock.calls[1]?.[1].grid.size).toBe(20);
    expect(f.getMapping).toHaveBeenCalledTimes(1);
    expect(result.current.state.mapping.grid.size).toBe(20);
  });

  it('reloads from the plugin on reconnect when there is nothing unsent', async () => {
    const f = fake(mapping(10));
    const { result, rerender } = await mount(f);
    rerender({ on: false });
    f.plugin.mapping = mapping(40); // changed while we were away
    rerender({ on: true });
    await settle();
    expect(f.getMapping).toHaveBeenCalledTimes(2);
    expect(result.current.state.mapping.grid.size).toBe(40);
    expect(f.setMapping).not.toHaveBeenCalled();
  });

  it('reconciles with the plugin after 2 s when an echo is lost', async () => {
    const f = fake(mapping(10));
    const { result } = await mount(f);
    act(() => result.current.dispatch({ type: 'setGrid', size: 20 }));
    await settle();
    f.plugin.mapping = mapping(50); // the plugin ended up elsewhere and no echo arrived
    await settle(1999);
    expect(f.getMapping).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(f.getMapping).toHaveBeenCalledTimes(2);
    expect(result.current.state.mapping.grid.size).toBe(50);
  });

  it('shows a failed initial load and retries it', async () => {
    const f = fake(mapping(10));
    f.getMapping.mockResolvedValueOnce({ ok: false, error: 'no such source' });
    const { result } = await mount(f);
    expect(result.current.loaded).toBe(false);
    expect(result.current.loadError).toBe('no such source');
    expect(result.current.toast?.text).toBe('no such source');
    act(() => result.current.retry());
    await settle();
    expect(result.current.loaded).toBe(true);
    expect(result.current.loadError).toBeNull();
  });
});
