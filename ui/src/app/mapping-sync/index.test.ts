import { jaNaming } from '../../test/naming';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { Mapping } from '../../model/mapping';
import type { MappingChangedHandler, ObsClient, VendorResult } from '../../obs/client';
import { createMappingSync, type MappingSync, type MappingSyncEvent } from '.';

const mapping = (grid: number): Mapping => ({ ...mapOf(), grid: { size: grid } });

type Fake = {
  client: ObsClient;
  getMapping: ReturnType<typeof vi.fn>;
  onMappingChanged: ReturnType<typeof vi.fn>;
  onOverlayChanged: ReturnType<typeof vi.fn>;
  setMapping: ReturnType<typeof vi.fn>;
  setOverlay: ReturnType<typeof vi.fn>;
  emit: (m: Mapping, overlayEnabled?: boolean, source?: string, requestId?: string | null) => void;
  emitOverlay: (enabled: boolean, source?: string) => void;
  plugin: { mapping: Mapping; overlayEnabled: boolean };
};

const fake = (initial: Mapping): Fake => {
  const plugin = { mapping: initial, overlayEnabled: false };
  let listener: MappingChangedHandler | null = null;
  let overlayListener: ((name: string, enabled: boolean) => void) | null = null;
  const getMapping = vi.fn(async () => ({ ok: true, mapping: plugin.mapping, overlayEnabled: plugin.overlayEnabled }) as VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>);
  const setOverlay = vi.fn(async () => ({ ok: true }) as VendorResult<{}>);
  const setMapping = vi.fn(async (_n: string, m: Mapping) => {
    plugin.mapping = m;
    return { ok: true } as VendorResult<{}>;
  });
  const onMappingChanged = vi.fn((cb: MappingChangedHandler) => {
    listener = cb;
    return () => {
      listener = null;
    };
  });
  const onOverlayChanged = vi.fn((cb: (name: string, enabled: boolean) => void) => {
    overlayListener = cb;
    return () => {
      overlayListener = null;
    };
  });
  const client: ObsClient = {
    listMappingSources: async () => ({ ok: true, sources: [] }),
    getMapping,
    setMapping,
    setOverlay,
    screenshot: async () => '',
    listInputs: async () => [],
    onMappingChanged,
    onOverlayChanged,
  };
  return {
    client,
    onMappingChanged,
    onOverlayChanged,
    getMapping,
    setMapping,
    setOverlay,
    plugin,
    emit: (m, overlayEnabled, source = 'Map', requestId = null) => listener?.(source, m, overlayEnabled, requestId),
    emitOverlay: (enabled, source = 'Map') => overlayListener?.(source, enabled),
  };
};

const deferred = <T>() => {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const settle = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

const create = (f: Fake, online = true, wired = true): { sync: MappingSync; events: MappingSyncEvent[] } => {
  const sync = createMappingSync({ client: f.client, now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>), online });
  const events: MappingSyncEvent[] = [];
  sync.subscribe((e) => events.push(e));
  if (wired) {
    sync.watchRemote();
    sync.startResync();
  }
  return { sync, events };
};

const openSource = async (sync: MappingSync, source = 'Map'): Promise<void> => {
  sync.open(source, await sync.load(source));
  await settle();
};

const mount = async (f: Fake, online = true) => {
  const made = create(f, online);
  await openSource(made.sync);
  return made;
};

const gridOf = (sync: MappingSync): number | undefined => sync.getState().editor?.mapping.grid.size;

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

describe('createMappingSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('load / open', () => {
    it('load() returns the plugin copy without mutating or emitting', async () => {
      const f = fake(mapping(10));
      f.plugin.overlayEnabled = true;
      const { sync, events } = create(f);
      const loaded = await sync.load('Map');
      expect(loaded.editor.mapping.grid.size).toBe(10);
      expect(loaded.overlayEnabled).toBe(true);
      expect(sync.getState()).toEqual({ source: null, editor: null, overlayEnabled: false, online: true });
      expect(events).toEqual([]);
      expect(f.setOverlay).not.toHaveBeenCalled();
    });

    it('load() rejects with the plugin message (shows a failed initial load; retry loads again)', async () => {
      const f = fake(mapping(10));
      f.getMapping.mockResolvedValueOnce({ ok: false, error: 'no such source' });
      const { sync } = create(f);
      await expect(sync.load('Map')).rejects.toThrow('no such source');
      expect(sync.getState().editor).toBeNull();
      await expect(sync.load('Map')).resolves.toBeDefined();
    });

    it('open() activates the session and emits source, editor and overlay', async () => {
      const f = fake(mapping(10));
      f.plugin.overlayEnabled = true;
      const { sync, events } = await mount(f);
      expect(sync.getState()).toMatchObject({ source: 'Map', overlayEnabled: true, online: true });
      expect(gridOf(sync)).toBe(10);
      expect(events.map((e) => e.type)).toEqual(['sourceChanged', 'editorChanged', 'overlayChanged']);
    });

    it('sends the selection but never enabled when opening', async () => {
      const f = fake(mapping(10));
      await mount(f);
      expect(f.setOverlay).toHaveBeenCalledTimes(1);
      expect(f.setOverlay.mock.calls[0]?.[1]).not.toHaveProperty('enabled');
    });
  });

  describe('sending', () => {
    it('sends a local edit once', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      expect(f.setMapping).not.toHaveBeenCalled();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      expect(f.setMapping).toHaveBeenCalledTimes(1);
      expect(f.setMapping.mock.calls[0]?.[1].grid.size).toBe(20);
    });

    it('emits editorChanged for local edits', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      events.length = 0;
      sync.dispatch({ type: 'setGrid', size: 20 });
      expect(events.some((e) => e.type === 'editorChanged' && e.editor.mapping.grid.size === 20)).toBe(true);
    });

    it('does not send back its own echo or a plugin-originated change', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      f.emit(mapping(20)); // echo of our own send
      await settle();
      f.emit(mapping(30)); // someone else's change
      await settle();
      expect(gridOf(sync)).toBe(30);
      expect(f.setMapping).toHaveBeenCalledTimes(1);
    });

    it('ignores MappingChanged of another source', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.emit(mapping(30), undefined, 'Other');
      expect(gridOf(sync)).toBe(10);
    });

    it('emits an error event when the plugin refuses a mapping', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      f.setMapping.mockResolvedValueOnce({ ok: false, error: 'bad mapping' });
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      expect(events).toContainEqual({ type: 'error', message: 'bad mapping' });
    });
  });

  describe('online / reconnect', () => {
    it('keeps edits pending while offline and resends them on reconnect instead of reloading', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.goOffline();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      expect(f.setMapping).not.toHaveBeenCalled();
      void sync.reconnect();
      await settle();
      expect(f.setMapping).toHaveBeenCalledTimes(1);
      expect(f.setMapping.mock.calls[0]?.[1].grid.size).toBe(20);
      expect(gridOf(sync)).toBe(20);
    });

    it('keeps an edit whose send failed in transport while still online and resends it on reconnect', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.setMapping.mockResolvedValueOnce({ ok: false, error: 'Not connected', transport: true });
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      expect(f.setMapping).toHaveBeenCalledTimes(1);
      sync.goOffline();
      void sync.reconnect();
      await settle();
      expect(f.setMapping).toHaveBeenCalledTimes(2);
      expect(f.setMapping.mock.calls[1]?.[1].grid.size).toBe(20);
      expect(gridOf(sync)).toBe(20);
    });

    it('reloads from the plugin on reconnect when there is nothing unsent', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.getMapping.mockClear();
      sync.goOffline();
      f.plugin.mapping = mapping(40); // changed while we were away
      void sync.reconnect();
      await settle();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(gridOf(sync)).toBe(40);
      expect(f.setMapping).not.toHaveBeenCalled();
    });

    it('refreshes overlayEnabled on reconnect even with unsent edits, without replacing the mapping', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.goOffline();
      sync.dispatch({ type: 'setGrid', size: 20 });
      f.plugin.overlayEnabled = true;
      f.plugin.mapping = mapping(99);
      void sync.reconnect();
      await settle();
      expect(sync.getState().overlayEnabled).toBe(true);
      expect(gridOf(sync)).toBe(20);
    });

    it('emits onlineChanged', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      sync.goOffline();
      expect(events).toContainEqual({ type: 'onlineChanged', online: false });
      expect(sync.getState().online).toBe(false);
    });

    it('sends descendant surfaces of a selected group', async () => {
      const grouped: Mapping = { ...mapOf(surf('s1', 0, 0), surf('s2', 0, 0)), groups: [groupOf('g1'), groupOf('g2')], layers: [gn('g1', sn('s1'), gn('g2', sn('s2')))] };
      const f = fake(grouped);
      const { sync } = await mount(f);
      sync.dispatch({ type: 'select', selection: { surfaceIds: [], groupIds: ['g1'], corner: null } });
      expect(f.setOverlay.mock.calls.at(-1)?.[1]).toMatchObject({ selectedSurfaceIds: ['s1', 's2'] });
    });

    it('never sends enabled on selection changes or reconnect', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.dispatch({ type: 'select', selection: { surfaceIds: ['x'], groupIds: [], corner: null } });
      sync.goOffline();
      void sync.reconnect();
      await settle();
      expect(f.setOverlay.mock.calls.length).toBeGreaterThan(1);
      expect(f.setOverlay.mock.calls.every((c) => (c[1] as { enabled?: boolean }).enabled === undefined)).toBe(true);
      expect(sync.getState().overlayEnabled).toBe(false);
    });
  });

  describe('idle resync', () => {
    it('reconciles with the plugin after 2 s when an echo is lost', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.getMapping.mockClear();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      f.plugin.mapping = mapping(50); // the plugin ended up elsewhere and no echo arrived
      await settle(1999);
      expect(f.getMapping).not.toHaveBeenCalled();
      await settle(1);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(gridOf(sync)).toBe(50);
    });

    it('does not resync again for the same stale in-flight list', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.getMapping.mockClear();
      sync.dispatch({ type: 'setGrid', size: 20 });
      f.plugin.mapping = mapping(20);
      await settle(10_000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });

    it('honours resyncIdleMs', async () => {
      const f = fake(mapping(10));
      const sync = createMappingSync({
        client: f.client,
        now: () => Date.now(),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
        online: true,
        resyncIdleMs: 100,
      });
      sync.startResync();
      await openSource(sync);
      f.getMapping.mockClear();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle(100);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });
  });

  describe('divergence resync', () => {
    const divergence = async (f: Fake) => {
      const made = await mount(f);
      made.sync.dispatch({ type: 'setGrid', size: 20 }); // A
      await settle();
      f.emit(mapping(99)); // foreign Z while A is unanswered
      made.sync.dispatch({ type: 'setGrid', size: 30 }); // B
      await settle();
      return made.sync;
    };

    it('fetches the plugin copy exactly once after the last echo drains inFlight', async () => {
      const f = fake(mapping(10));
      const sync = await divergence(f);
      expect(f.plugin.mapping.grid.size).toBe(30);
      expect(gridOf(sync)).toBe(30);
      f.getMapping.mockClear();
      f.emit(mapping(20)); // echo A
      await settle();
      expect(f.getMapping).not.toHaveBeenCalled();
      f.emit(mapping(30)); // echo B
      await settle();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(gridOf(sync)).toBe(30);
      expect(sync.getState().editor?.needsResync).toBe(false);
      await settle(5000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });

    it('does not fetch when no divergence happened', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      f.getMapping.mockClear();
      f.emit(mapping(20));
      await settle(5000);
      expect(f.getMapping).not.toHaveBeenCalled();
    });

    it('does not fetch while a send is still queued', async () => {
      const f = fake(mapping(10));
      const sync = await divergence(f);
      f.getMapping.mockClear();
      let release: () => void = () => undefined;
      f.setMapping.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ ok: true });
          }),
      );
      sync.dispatch({ type: 'setGrid', size: 40 }); // C, unanswered
      await settle();
      f.emit(mapping(20));
      f.emit(mapping(30)); // A and B echoes; C is still unsent
      await settle();
      expect(f.getMapping).not.toHaveBeenCalled();
      release();
      await settle();
      f.emit(mapping(40));
      await settle();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });

    it('drops a divergence response that arrives while a new local edit is unsent or in flight', async () => {
      const f = fake(mapping(10));
      const sync = await divergence(f);
      f.emit(mapping(20));
      let answer: (v: unknown) => void = () => undefined;
      f.getMapping.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
      f.emit(mapping(30)); // drains inFlight: the resync fetch starts
      await settle();
      sync.dispatch({ type: 'setGrid', size: 60 });
      answer({ ok: true, mapping: mapping(77), overlayEnabled: false });
      await settle();
      expect(gridOf(sync)).toBe(60);
    });

    it('drops a divergence response that arrives after the source switched', async () => {
      const f = fake(mapping(10));
      const sync = await divergence(f);
      f.emit(mapping(20));
      let answer: (v: unknown) => void = () => undefined;
      f.getMapping.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
      f.emit(mapping(30));
      await settle();
      f.plugin.mapping = mapping(5);
      await openSource(sync, 'Other');
      answer({ ok: true, mapping: mapping(77), overlayEnabled: false });
      await settle();
      expect(gridOf(sync)).toBe(5);
    });
  });

  describe('overlay', () => {
    const sentFlags = (f: Fake): unknown[] => f.setOverlay.mock.calls.map((c) => (c[1] as { enabled?: boolean }).enabled);

    it('takes the initial toggle state from GetMapping', async () => {
      const f = fake(mapping(10));
      f.plugin.overlayEnabled = true;
      const { sync } = await mount(f);
      expect(sync.getState().overlayEnabled).toBe(true);
      expect(sentFlags(f).every((e) => e === undefined)).toBe(true);
    });

    it('only setOverlay sends enabled, and follows OverlayChanged / MappingChanged', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      sync.setOverlay(true);
      await settle();
      expect(sync.getState().overlayEnabled).toBe(true);
      expect(sentFlags(f)).toContain(true);
      f.emitOverlay(false);
      expect(sync.getState().overlayEnabled).toBe(false);
      f.emit(mapping(10), true);
      expect(sync.getState().overlayEnabled).toBe(true);
      expect(events.filter((e) => e.type === 'overlayChanged').length).toBeGreaterThanOrEqual(3);
    });

    it('puts the toggle back and emits an error when the plugin refuses', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      f.setOverlay.mockResolvedValueOnce({ ok: false, error: 'refused' });
      sync.setOverlay(true);
      await settle();
      expect(sync.getState().overlayEnabled).toBe(false);
      expect(events).toContainEqual({ type: 'error', message: 'refused' });
    });

    it('does nothing while offline', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f, false);
      f.setOverlay.mockClear();
      sync.setOverlay(true);
      expect(f.setOverlay).not.toHaveBeenCalled();
    });

    it('switches off what it turned on when the source changes', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.setOverlay(true);
      await settle();
      f.setOverlay.mockClear();
      await openSource(sync, 'Other');
      expect(f.setOverlay).toHaveBeenCalledWith('Map', expect.objectContaining({ enabled: false }));
    });

    it('does not switch off an overlay it did not turn on', async () => {
      const f = fake(mapping(10));
      f.plugin.overlayEnabled = true;
      const { sync } = await mount(f);
      f.setOverlay.mockClear();
      await openSource(sync, 'Other');
      expect(f.setOverlay.mock.calls.some((c) => c[0] === 'Map')).toBe(false);
    });
  });

  describe('source switch', () => {
    it('flushes a throttled pending edit to the old source before switching', async () => {
      const f = fake(withSurface());
      const { sync } = await mount(f);
      sync.dispatch({ type: 'dragStart' });
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 });
      await settle(1);
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 }); // throttled behind the first
      await settle(1);
      expect(f.setMapping).toHaveBeenCalledTimes(1);
      await openSource(sync, 'Other');
      expect(f.setMapping.mock.calls.filter((c) => c[0] === 'Map')).toHaveLength(2);
      expect(f.setMapping.mock.calls.filter((c) => c[0] === 'Other')).toHaveLength(0);
    });

    it('close() leaves the source and emits sourceChanged null', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      sync.close();
      expect(sync.getState().source).toBeNull();
      expect(events.at(-1)).toEqual({ type: 'sourceChanged', source: null });
    });
  });

  describe('applyImport', () => {
    it('drops queued edits so they cannot overwrite the import', async () => {
      const f = fake(withSurface());
      const { sync } = await mount(f);
      sync.dispatch({ type: 'dragStart' });
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 });
      await settle(1);
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 });
      expect(await sync.applyImport(mapping(77))).toBe(true);
      await sync.reload();
      await settle(200);
      expect(f.setMapping.mock.calls.at(-1)?.[1].grid.size).toBe(77);
      expect(gridOf(sync)).toBe(77);
    });

    it('emits an error and restores the discarded edit when the plugin refuses', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f, false);
      sync.dispatch({ type: 'setGrid', size: 20 }); // stays unsent while offline
      void sync.reconnect();
      f.setMapping.mockClear();
      f.setMapping.mockResolvedValueOnce({ ok: false, error: 'bad import' });
      expect(await sync.applyImport(mapping(77))).toBe(false);
      expect(events).toContainEqual({ type: 'error', message: 'bad import' });
      await settle();
      expect(f.setMapping.mock.calls.at(-1)?.[1].grid.size).toBe(20);
      expect(gridOf(sync)).toBe(20);
    });

    it('resolves false without a session', async () => {
      const { sync } = create(fake(mapping(10)));
      expect(await sync.applyImport(mapping(1))).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('dispose() flushes a throttled edit and stops reacting', async () => {
      const f = fake(withSurface());
      const { sync } = await mount(f);
      sync.dispatch({ type: 'dragStart' });
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 });
      await settle(1);
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 });
      sync.dispose();
      expect(f.setMapping).toHaveBeenCalledTimes(2);
      f.emit(mapping(55));
      expect(sync.getState().editor).toBeNull();
    });

    it('terminate() disposes after a microtask', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.terminate();
      expect(sync.getState().source).toBe('Map');
      await Promise.resolve();
      expect(sync.getState().source).toBeNull();
    });

    it('terminate() then cancelTerminate() keeps the session alive', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.terminate();
      expect(sync.cancelTerminate()).toBe(true);
      await Promise.resolve();
      expect(sync.getState().source).toBe('Map');
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      expect(f.setMapping).toHaveBeenCalledTimes(1);
    });

    it('cancelTerminate() reports false when nothing is pending', () => {
      expect(create(fake(mapping(10))).sync.cancelTerminate()).toBe(false);
    });
  });

  describe('commit-then-emit (I2, M8)', () => {
    it('a subscriber that dispatches on editorChanged still leaves the plugin on the latest mapping', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      let fired = false;
      sync.subscribe((e) => {
        if (e.type !== 'editorChanged' || fired || e.editor.mapping.grid.size !== 20) return;
        fired = true;
        sync.dispatch({ type: 'setGrid', size: 30 });
      });
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle(200);
      expect(f.plugin.mapping.grid.size).toBe(30);
      expect(f.setMapping.mock.calls.at(-1)?.[1].grid.size).toBe(30);
      expect(gridOf(sync)).toBe(30);
    });

    it('every subscriber sees the editor states in order, ending on the latest', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      let fired = false;
      sync.subscribe((e) => {
        if (e.type !== 'editorChanged' || fired || e.editor.mapping.grid.size !== 20) return;
        fired = true;
        sync.dispatch({ type: 'setGrid', size: 30 });
      });
      const seen: number[] = [];
      sync.subscribe((e) => {
        if (e.type === 'editorChanged') seen.push(e.editor.mapping.grid.size);
      });
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle(200);
      expect(seen.slice(0, 2)).toEqual([20, 30]);
      expect(seen.at(-1)).toBe(30);
    });

    it('emits editorChanged once per local edit, not again for the in-flight bookkeeping', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      events.length = 0;
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      expect(events.filter((e) => e.type === 'editorChanged')).toHaveLength(1);
    });

    it('getState() keeps its identity until something changes', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      const before = sync.getState();
      expect(sync.getState()).toBe(before);
      sync.dispatch({ type: 'setGrid', size: 20 });
      const after = sync.getState();
      expect(after).not.toBe(before);
      expect(sync.getState()).toBe(after);
      sync.goOffline();
      expect(sync.getState()).not.toBe(after);
    });
  });

  describe('changes between load() and open() (I3)', () => {
    it('applies a MappingChanged that arrived after load() started', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f);
      const loaded = await sync.load('Map');
      f.emit(mapping(55));
      sync.open('Map', loaded);
      expect(gridOf(sync)).toBe(55);
    });

    it('applies an OverlayChanged that arrived after load() started', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f);
      const loaded = await sync.load('Map');
      f.emitOverlay(true);
      sync.open('Map', loaded);
      expect(sync.getState().overlayEnabled).toBe(true);
    });

    it('does not replay changes that load() already contains', async () => {
      const f = fake(mapping(10));
      const { sync, events } = create(f);
      f.emit(mapping(55));
      f.plugin.mapping = mapping(55);
      const loaded = await sync.load('Map');
      sync.open('Map', loaded);
      expect(gridOf(sync)).toBe(55);
      expect(events.filter((e) => e.type === 'editorChanged')).toHaveLength(1);
    });

    it('A to B to A with a stale cached load result opens the latest mapping', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f);
      const staleA = await sync.load('Map');
      sync.open('Map', staleA);
      sync.open('Other', await sync.load('Other'));
      f.emit(mapping(77), undefined, 'Map');
      sync.open('Map', staleA);
      expect(sync.getState().source).toBe('Map');
      expect(gridOf(sync)).toBe(77);
    });

    it('load() itself stays pure while the feed is live', async () => {
      const f = fake(mapping(10));
      const { sync, events } = create(f);
      f.emit(mapping(55));
      await sync.load('Map');
      expect(events).toEqual([]);
      expect(sync.getState().editor).toBeNull();
    });
  });

  describe('open() (M4)', () => {
    it('opening the already-active source is a no-op that keeps overlay ownership and undo history', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      sync.setOverlay(true);
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      f.setOverlay.mockClear();
      events.length = 0;
      sync.open('Map', await sync.load('Map'));
      await settle();
      expect(events).toEqual([]);
      expect(f.setOverlay).not.toHaveBeenCalled();
      expect(sync.getState().editor?.past.length).toBe(1);
      expect(sync.getState().overlayEnabled).toBe(true);
    });

    it('a sourceChanged subscriber that opens another source does not get stale editor events afterwards', async () => {
      const f = fake(mapping(10));
      const { sync, events } = create(f);
      const first = await sync.load('Map');
      f.plugin.mapping = mapping(99);
      const second = await sync.load('Other');
      sync.subscribe((e) => {
        if (e.type === 'sourceChanged' && e.source === 'Map') sync.open('Other', second);
      });
      sync.open('Map', first);
      expect(sync.getState().source).toBe('Other');
      expect(events.filter((e) => e.type === 'editorChanged').at(-1)).toMatchObject({ editor: { mapping: { grid: { size: 99 } } } });
    });
  });

  describe('switching source with an edit still pending (M1)', () => {
    it('waits for the in-flight answer, then sends the last pending edit to the old source', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      const first = deferred<VendorResult<{}>>();
      f.setMapping.mockImplementationOnce(() => first.promise);
      sync.dispatch({ type: 'setGrid', size: 20 });
      sync.dispatch({ type: 'setGrid', size: 30 });
      await openSource(sync, 'Other');
      first.resolve({ ok: true });
      await settle();
      expect(f.setMapping.mock.calls.map((c) => [c[0], c[1].grid.size])).toEqual([
        ['Map', 20],
        ['Map', 30],
      ]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('offline: keeps the edit bound to the old source and sends it on reconnect', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.goOffline();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await openSource(sync, 'Other');
      expect(f.setMapping).not.toHaveBeenCalled();
      void sync.reconnect();
      await settle();
      expect(f.setMapping.mock.calls.map((c) => [c[0], c[1].grid.size])).toEqual([['Map', 20]]);
    });

    it('still reports a refusal from the final flush after the switch', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      const first = deferred<VendorResult<{}>>();
      f.setMapping.mockImplementationOnce(() => first.promise);
      sync.dispatch({ type: 'setGrid', size: 20 });
      await openSource(sync, 'Other');
      first.resolve({ ok: false, error: 'late refusal' });
      await settle();
      expect(events).toContainEqual({ type: 'error', message: 'late refusal' });
    });
  });

  describe('nested emits are delivered in causal order (N2)', () => {
    it('a sourceChanged subscriber that opens another source: later subscribers see Map then Other', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f);
      const first = await sync.load('Map');
      const second = await sync.load('Other');
      sync.subscribe((e) => {
        if (e.type === 'sourceChanged' && e.source === 'Map') sync.open('Other', second);
      });
      const seen: (string | null)[] = [];
      sync.subscribe((e) => {
        if (e.type === 'sourceChanged') seen.push(e.source);
      });
      sync.open('Map', first);
      expect(seen).toEqual(['Map', 'Other']);
      expect(sync.getState().source).toBe('Other');
    });

    it('an overlayChanged subscriber that toggles back: later subscribers end on the latest value', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.subscribe((e) => {
        if (e.type === 'overlayChanged' && e.enabled) sync.setOverlay(false);
      });
      const seen: boolean[] = [];
      sync.subscribe((e) => {
        if (e.type === 'overlayChanged') seen.push(e.enabled);
      });
      sync.setOverlay(true);
      await settle();
      expect(seen).toEqual([true, false]);
    });
  });

  describe('re-opening a source whose old session still holds an unsent edit (N3)', () => {
    const grid = (calls: { mock: { calls: unknown[][] } }) => calls.mock.calls.map((c) => [c[0], (c[1] as Mapping).grid.size, (c[1] as Mapping).surfaces.length]);

    it('hands the unsent edit to the new session: shown at once, e2 builds on e1, one writer', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f);
      const cachedA = await sync.load('Map');
      sync.open('Map', cachedA);
      sync.goOffline();
      sync.dispatch({ type: 'setGrid', size: 20 });
      sync.open('Other', await sync.load('Other'));
      sync.open('Map', cachedA);
      expect(gridOf(sync)).toBe(20);
      sync.dispatch({ type: 'addSurface', source: 's', naming: jaNaming });
      expect(f.setMapping).not.toHaveBeenCalled();
      void sync.reconnect();
      await settle(200);
      expect(grid(f.setMapping)).toEqual([['Map', 20, 1]]);
    });

    it('with no new edit the carried edit is still delivered once', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f);
      const cachedA = await sync.load('Map');
      sync.open('Map', cachedA);
      sync.goOffline();
      sync.dispatch({ type: 'setGrid', size: 20 });
      sync.open('Other', await sync.load('Other'));
      sync.open('Map', cachedA);
      void sync.reconnect();
      await settle(200);
      expect(grid(f.setMapping)).toEqual([['Map', 20, 0]]);
    });
  });

  describe('stale reload (M2)', () => {
    it('a reconnect reload answered after a local edit does not wipe the edit or its history', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.goOffline();
      const answer = deferred<VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>>();
      f.getMapping.mockImplementationOnce(() => answer.promise);
      void sync.reconnect();
      sync.dispatch({ type: 'setGrid', size: 20 });
      answer.resolve({ ok: true, mapping: mapping(10), overlayEnabled: false });
      await settle();
      expect(gridOf(sync)).toBe(20);
      expect(sync.getState().editor?.past.length).toBe(1);
    });

    it('a failed reconnect reload becomes an error event (T1)', async () => {
      const f = fake(mapping(10));
      const { sync, events } = await mount(f);
      sync.goOffline();
      f.getMapping.mockResolvedValueOnce({ ok: false, error: 'gone' });
      void sync.reconnect();
      await settle();
      expect(events).toContainEqual({ type: 'error', message: 'gone' });
    });
  });

  describe('resync edge cases', () => {
    it('keeps the idle resync alive when the timer fires while the send is still unanswered (M9)', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.getMapping.mockClear();
      const slow = deferred<VendorResult<{}>>();
      f.setMapping.mockImplementationOnce(() => slow.promise);
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle(3000);
      expect(f.getMapping).not.toHaveBeenCalled();
      f.plugin.mapping = mapping(50);
      slow.resolve({ ok: true });
      await settle(2000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(gridOf(sync)).toBe(50);
    });

    it('drops an idle resync response that arrives after the source switched (T2)', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      const answer = deferred<VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>>();
      f.getMapping.mockImplementationOnce(() => answer.promise);
      await settle(2000);
      f.plugin.mapping = mapping(5);
      await openSource(sync, 'Other');
      answer.resolve({ ok: true, mapping: mapping(77), overlayEnabled: false });
      await settle();
      expect(gridOf(sync)).toBe(5);
    });

    it('drops an idle resync response that arrives after a new local edit (T2)', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      const answer = deferred<VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>>();
      f.getMapping.mockImplementationOnce(() => answer.promise);
      await settle(2000);
      sync.dispatch({ type: 'setGrid', size: 60 });
      answer.resolve({ ok: true, mapping: mapping(77), overlayEnabled: false });
      await settle();
      expect(gridOf(sync)).toBe(60);
    });

    it('drains the stale in-flight list with a different plugin copy and does not resync again (T8)', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.getMapping.mockClear();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle();
      f.plugin.mapping = mapping(77);
      await settle(2000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(sync.getState().editor?.inFlight).toEqual([]);
      await settle(10_000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });
  });

  describe('applyImport reload', () => {
    it('applyImport() only writes; the consumer reloads from the plugin explicitly', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      f.getMapping.mockClear();
      f.setMapping.mockImplementationOnce(async (_n: string, m: Mapping) => {
        f.plugin.mapping = { ...m, grid: { size: 78 } };
        return { ok: true };
      });
      expect(await sync.applyImport(mapping(77))).toBe(true);
      expect(f.getMapping).not.toHaveBeenCalled();
      await sync.reload();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(gridOf(sync)).toBe(78);
    });
  });

  describe('no implicit effects', () => {
    it('construction and getState() make no client calls, start no timers and emit nothing', async () => {
      const f = fake(mapping(10));
      const { sync, events } = create(f, true, false);
      sync.getState();
      await settle(60_000);
      expect(f.getMapping).not.toHaveBeenCalled();
      expect(f.setMapping).not.toHaveBeenCalled();
      expect(f.setOverlay).not.toHaveBeenCalled();
      expect(f.onMappingChanged).not.toHaveBeenCalled();
      expect(f.onOverlayChanged).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(events).toEqual([]);
    });

    it('load() makes exactly one GetMapping and nothing else', async () => {
      const f = fake(mapping(10));
      const { sync, events } = create(f, true, false);
      await sync.load('Map');
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(f.setOverlay).not.toHaveBeenCalled();
      expect(f.onMappingChanged).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(events).toEqual([]);
    });

    it('remote events are ignored until watchRemote() is called, and again after its stop', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f, true, false);
      await openSource(sync);
      f.emit(mapping(55));
      expect(gridOf(sync)).toBe(10);
      const stop = sync.watchRemote();
      f.emit(mapping(56));
      expect(gridOf(sync)).toBe(56);
      stop();
      stop();
      f.emit(mapping(57));
      expect(gridOf(sync)).toBe(56);
    });

    it('watchRemote() twice subscribes once', () => {
      const f = fake(mapping(10));
      const { sync } = create(f, true, false);
      const a = sync.watchRemote();
      sync.watchRemote();
      expect(f.onMappingChanged).toHaveBeenCalledTimes(1);
      a();
    });

    it('watchRemote() callers each get their own stop; the subscription ends with the last one', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f, true, false);
      await openSource(sync);
      const a = sync.watchRemote();
      const b = sync.watchRemote();
      a();
      a();
      f.emit(mapping(56));
      expect(gridOf(sync)).toBe(56);
      b();
      f.emit(mapping(57));
      expect(gridOf(sync)).toBe(56);
    });

    it('startResync() callers each get their own stop; the timer ends with the last one', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f, true, false);
      await openSource(sync);
      const a = sync.startResync();
      const b = sync.startResync();
      f.getMapping.mockClear();
      a();
      a();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle(2000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      b();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('no resync runs until startResync(); its stop is idempotent', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f, true, false);
      await openSource(sync);
      f.getMapping.mockClear();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle(10_000);
      expect(f.getMapping).not.toHaveBeenCalled();
      const stop = sync.startResync();
      await settle(2000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      stop();
      stop();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('startResync() before open() applies to the source opened later', async () => {
      const f = fake(mapping(10));
      const { sync } = create(f, true, false);
      sync.startResync();
      await openSource(sync);
      f.getMapping.mockClear();
      sync.dispatch({ type: 'setGrid', size: 20 });
      await settle(2000);
      expect(f.getMapping).toHaveBeenCalledTimes(1);
    });

    it('reconnect() is explicit: going online by itself reloads nothing', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f, false);
      f.getMapping.mockClear();
      await settle(10_000);
      expect(f.getMapping).not.toHaveBeenCalled();
      await sync.reconnect();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(sync.getState().online).toBe(true);
    });

    it('dispose() stops a running watch and resync', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      sync.dispatch({ type: 'setGrid', size: 20 });
      sync.dispose();
      f.emit(mapping(55));
      await settle(10_000);
      expect(vi.getTimerCount()).toBe(0);
      expect(sync.getState().editor).toBeNull();
    });
  });

  describe('teardown (M7, T4)', () => {
    it('isDisposed() reports the lifecycle', async () => {
      const { sync } = await mount(fake(mapping(10)));
      expect(sync.isDisposed()).toBe(false);
      sync.dispose();
      expect(sync.isDisposed()).toBe(true);
    });

    it('dispose() leaves no timers behind with a throttled edit and an idle resync pending', async () => {
      const f = fake(withSurface());
      const { sync } = await mount(f);
      sync.dispatch({ type: 'dragStart' });
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 });
      await settle(1);
      sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 1, dy: 0 });
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      sync.dispose();
      await settle();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
  describe('request-id round trip (#4)', () => {
    const idsOf = (f: Fake): string[] => f.setMapping.mock.calls.map((c) => c[2] as string);
    const sendGrid = async (sync: MappingSync, size: number): Promise<void> => {
      sync.dispatch({ type: 'setGrid', size });
      await settle(40);
    };

    it('sends ids of the form nonce-n, counting up', async () => {
      const f = fake(mapping(10));
      const sync = createMappingSync({
        client: f.client,
        now: () => Date.now(),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
        online: true,
        instanceNonce: 'n1',
      });
      await openSource(sync);
      await sendGrid(sync, 20);
      await sendGrid(sync, 30);
      expect(idsOf(f)).toEqual(['n1-1', 'n1-2']);
    });

    it('A, B, A with id echoes never flashes the editor to B', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      await sendGrid(sync, 20); // A
      await sendGrid(sync, 30); // B
      sync.dispatch({ type: 'undo' }); // A again
      await settle(40);
      const [a1, b, a2] = idsOf(f);
      expect(idsOf(f)).toHaveLength(3);
      const seen: (number | undefined)[] = [];
      sync.subscribe(() => seen.push(gridOf(sync)));
      f.emit(mapping(20), undefined, 'Map', a1);
      f.emit(mapping(30), undefined, 'Map', b);
      f.emit(mapping(20), undefined, 'Map', a2);
      expect(gridOf(sync)).toBe(20);
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((g) => g === 20)).toBe(true);
      expect(sync.getState().editor?.inFlight).toEqual([]);
    });

    it('an echo of unchanged content still acknowledges its id', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      await sendGrid(sync, 20);
      f.emit(mapping(20), undefined, 'Map', idsOf(f)[0]);
      expect(sync.getState().editor?.inFlight).toEqual([]);
      expect(sync.getState().editor?.needsResync).toBe(false);
    });

    it('a plugin without requestId is matched oldest-first by content', async () => {
      const f = fake(mapping(10));
      const { sync } = await mount(f);
      await sendGrid(sync, 20); // A
      await sendGrid(sync, 30); // B
      sync.dispatch({ type: 'undo' });
      await settle(40);
      f.emit(mapping(20));
      f.emit(mapping(30));
      expect(gridOf(sync)).toBe(20);
      f.emit(mapping(20));
      expect(gridOf(sync)).toBe(20);
      expect(sync.getState().editor?.inFlight).toEqual([]);
    });

    const mountWithNonce = async (f: Fake) => {
      const sync = createMappingSync({
        client: f.client,
        now: () => Date.now(),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
        online: true,
        instanceNonce: 'n1',
      });
      sync.watchRemote();
      sync.startResync();
      await openSource(sync);
      return sync;
    };

    it('after a multi-frame drag whose echoes arrived mid-drag, the idle resync drains inFlight without churn', async () => {
      const f = fake(withSurface());
      const sync = await mountWithNonce(f);
      sync.dispatch({ type: 'dragStart' });
      for (let i = 0; i < 3; i++) {
        sync.dispatch({ type: 'dragSurface', surfaceId: 'x', dx: 5, dy: 0 });
        await settle(40);
      }
      for (const id of idsOf(f)) f.emit(f.plugin.mapping, undefined, 'Map', id);
      sync.dispatch({ type: 'dragEnd' });
      const before = sync.getState().editor?.mapping;
      expect(sync.getState().editor?.inFlight.length).toBeGreaterThan(0);
      await settle(2000);
      expect(sync.getState().editor?.inFlight).toEqual([]);
      expect(sync.getState().editor?.needsResync).toBe(false);
      expect(sync.getState().editor?.mapping).toBe(before);
    });

    it('when every echo is lost the idle resync adopts the plugin copy and drains inFlight', async () => {
      const f = fake(mapping(10));
      const sync = await mountWithNonce(f);
      await sendGrid(sync, 20);
      await sendGrid(sync, 30);
      f.plugin.mapping = mapping(50);
      await settle(2000);
      expect(gridOf(sync)).toBe(50);
      expect(sync.getState().editor?.inFlight).toEqual([]);
      expect(sync.getState().editor?.needsResync).toBe(false);
    });

    it('a reordered echo of our own id (already consumed) keeps local and recovers through a resync', async () => {
      const f = fake(mapping(10));
      const sync = await mountWithNonce(f);
      await sendGrid(sync, 20); // A = n1-1
      await sendGrid(sync, 30); // B = n1-2
      const [a, b] = idsOf(f);
      f.emit(mapping(30), undefined, 'Map', b);
      f.getMapping.mockClear();
      f.emit(mapping(20), undefined, 'Map', a);
      expect(gridOf(sync)).toBe(30);
      await settle();
      expect(f.getMapping).toHaveBeenCalledTimes(1);
      expect(gridOf(sync)).toBe(30);
      expect(sync.getState().editor?.needsResync).toBe(false);
    });

    it('two docks on one plugin never collide, and each treats the other echo as foreign', async () => {
      const f = fake(mapping(10));
      const make = (instanceNonce: string) =>
        createMappingSync({
          client: f.client,
          now: () => Date.now(),
          setTimer: (fn, ms) => setTimeout(fn, ms),
          clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
          online: true,
          instanceNonce,
        });
      const dock1 = make('d1');
      const dock2 = make('d2');
      dock1.watchRemote();
      await openSource(dock1);
      await openSource(dock2);
      await sendGrid(dock1, 20);
      await sendGrid(dock2, 20);
      expect(idsOf(f)).toEqual(['d1-1', 'd2-1']);
      f.emit(mapping(20), undefined, 'Map', 'd2-1');
      expect(dock1.getState().editor?.inFlight).toHaveLength(1);
      expect(dock1.getState().editor?.needsResync).toBe(true);
    });
  });
});
