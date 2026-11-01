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
  setOverlay: ReturnType<typeof vi.fn>;
  emit: (m: Mapping, overlayEnabled?: boolean) => void;
  emitOverlay: (enabled: boolean) => void;
  plugin: { mapping: Mapping; overlayEnabled: boolean };
};

const fake = (initial: Mapping): Fake => {
  const plugin = { mapping: initial, overlayEnabled: false };
  let listener: ((name: string, m: Mapping, overlayEnabled: boolean | undefined) => void) | null = null;
  let overlayListener: ((name: string, enabled: boolean) => void) | null = null;
  const getMapping = vi.fn(async () => ({ ok: true, mapping: plugin.mapping, overlayEnabled: plugin.overlayEnabled }) as VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>);
  const setOverlay = vi.fn(async () => ({ ok: true }) as VendorResult<{}>);
  const setMapping = vi.fn(async (_n: string, m: Mapping) => {
    plugin.mapping = m;
    return { ok: true } as VendorResult<{}>;
  });
  const client: ObsClient = {
    listMappingSources: async () => ({ ok: true, sources: [] }),
    getMapping,
    setMapping,
    setOverlay,
    screenshot: async () => '',
    listInputs: async () => [],
    onMappingChanged: (cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    onOverlayChanged: (cb) => {
      overlayListener = cb;
      return () => {
        overlayListener = null;
      };
    },
  };
  return {
    client,
    getMapping,
    setMapping,
    setOverlay,
    plugin,
    emit: (m, overlayEnabled) => listener?.('Map', m, overlayEnabled),
    emitOverlay: (enabled) => overlayListener?.('Map', enabled),
  };
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

  describe('divergence resync', () => {
    const divergence = async (f: Fake) => {
      const { result } = await mount(f);
      act(() => result.current.dispatch({ type: 'setGrid', size: 20 })); // A
      await settle();
      act(() => f.emit(mapping(99))); // foreign Z while A is unanswered
      act(() => result.current.dispatch({ type: 'setGrid', size: 30 })); // B
      await settle();
      return result;
    };

    it('fetches the plugin copy exactly once after the last echo drains inFlight', async () => {
      const f = fake(mapping(10));
      const result = await divergence(f);
      expect(f.plugin.mapping.grid.size).toBe(30);
      expect(result.current.state.mapping.grid.size).toBe(30);
      f.getMapping.mockClear();
      act(() => f.emit(mapping(20))); // echo A
      await settle();
      expect(f.getMapping).not.toHaveBeenCalled();
      act(() => f.emit(mapping(30))); // echo B
      await settle();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(result.current.state.mapping.grid.size).toBe(30);
      expect(result.current.state.needsResync).toBe(false);
      await settle(5000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });

    it('does not fetch when no divergence happened', async () => {
      const f = fake(mapping(10));
      const { result } = await mount(f);
      act(() => result.current.dispatch({ type: 'setGrid', size: 20 }));
      await settle();
      f.getMapping.mockClear();
      act(() => f.emit(mapping(20)));
      await settle(5000);
      expect(f.getMapping).not.toHaveBeenCalled();
    });

    it('does not fetch while a send is still queued', async () => {
      const f = fake(mapping(10));
      const result = await divergence(f);
      f.getMapping.mockClear();
      let release: () => void = () => undefined;
      f.setMapping.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ ok: true });
          }),
      );
      act(() => result.current.dispatch({ type: 'setGrid', size: 40 })); // C, unanswered
      await settle();
      act(() => f.emit(mapping(20)));
      act(() => f.emit(mapping(30))); // A and B echoes; C is still unsent
      await settle();
      expect(f.getMapping).not.toHaveBeenCalled();
      await act(async () => {
        release();
        await vi.advanceTimersByTimeAsync(0);
      });
      act(() => f.emit(mapping(40)));
      await settle();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });
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

  describe('overlay', () => {
    const sentFlags = (f: Fake): unknown[] => f.setOverlay.mock.calls.map((c) => (c[1] as { enabled?: boolean }).enabled);

    it('never sends enabled on load, selection changes or reconnect', async () => {
      const f = fake(mapping(10));
      const { result, rerender } = await mount(f);
      expect(f.setOverlay).toHaveBeenCalled();
      act(() => result.current.dispatch({ type: 'select', selection: { surfaceIds: ['x'], corner: null } }));
      rerender({ on: false });
      rerender({ on: true });
      await settle();
      expect(sentFlags(f).every((e) => e === undefined)).toBe(true);
      expect(result.current.overlayEnabled).toBe(false);
    });

    it('takes the initial toggle state from GetMapping', async () => {
      const f = fake(mapping(10));
      f.plugin.overlayEnabled = true;
      const { result } = await mount(f);
      expect(result.current.overlayEnabled).toBe(true);
      expect(sentFlags(f).every((e) => e === undefined)).toBe(true);
    });

    it('only the toggle sends enabled, and follows OverlayChanged / MappingChanged', async () => {
      const f = fake(mapping(10));
      const { result } = await mount(f);
      act(() => result.current.setOverlayEnabled(true));
      await settle();
      expect(result.current.overlayEnabled).toBe(true);
      expect(sentFlags(f)).toContain(true);
      act(() => f.emitOverlay(false));
      expect(result.current.overlayEnabled).toBe(false);
      act(() => f.emit(mapping(10), true));
      expect(result.current.overlayEnabled).toBe(true);
    });

    it('switches off what it turned on when the source changes', async () => {
      const f = fake(mapping(10));
      const hook = renderHook(({ src }) => useSync(f.client, src, true), { initialProps: { src: 'Map' } });
      await settle();
      act(() => hook.result.current.setOverlayEnabled(true));
      await settle();
      f.setOverlay.mockClear();
      hook.rerender({ src: 'Other' });
      await settle();
      expect(f.setOverlay).toHaveBeenCalledWith('Map', expect.objectContaining({ enabled: false }));
    });
  });

  const withSurface = (): Mapping => ({
    ...mapping(10),
    surfaces: [
      {
        id: 'x',
        name: 'x',
        type: 'quad',
        source: 's',
        crop: { x: 0, y: 0, width: 1, height: 1 },
        corners: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        visible: true,
      },
    ],
  });

  it('flushes a throttled pending edit to the old source before switching', async () => {
    const f = fake(withSurface());
    const hook = renderHook(({ src }) => useSync(f.client, src, true), { initialProps: { src: 'Map' } });
    await settle();
    act(() => hook.result.current.dispatch({ type: 'dragStart' }));
    act(() => hook.result.current.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 }));
    await settle(1);
    act(() => hook.result.current.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 })); // throttled behind the first
    await settle(1);
    expect(f.setMapping).toHaveBeenCalledTimes(1);
    hook.rerender({ src: 'Other' });
    await settle();
    expect(f.setMapping.mock.calls.filter((c) => c[0] === 'Map')).toHaveLength(2);
  });

  it('applyImport drops queued edits so they cannot overwrite the import', async () => {
    const f = fake(withSurface());
    const { result } = await mount(f);
    act(() => result.current.dispatch({ type: 'dragStart' }));
    act(() => result.current.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 }));
    await settle(1);
    act(() => result.current.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 }));
    await act(async () => {
      await result.current.applyImport(mapping(77));
    });
    await settle(200);
    expect(f.setMapping.mock.calls.at(-1)?.[1].grid.size).toBe(77);
    expect(result.current.state.mapping.grid.size).toBe(77);
  });
});
