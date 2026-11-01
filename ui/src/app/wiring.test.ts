import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mapping } from '../model/mapping';
import type { ObsClient, ObsConnection, VendorResult } from '../obs/client';
import { createMappingSync } from './mapping-sync';
import { createObsSession } from './obs-session';

const mapping = (grid: number): Mapping => ({ version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: grid }, surfaces: [] });

const fakeObs = (initial: Mapping) => {
  const plugin = { mapping: initial };
  let closeCb: ((code: number) => void) | null = null;
  let mappingCb: ((name: string, m: Mapping, overlay: boolean | undefined) => void) | null = null;
  const listMappingSources = vi.fn(async () => ({ ok: true, sources: [{ name: 'Map', width: 1920, height: 1080 }] }) as VendorResult<{ sources: { name: string; width: number; height: number }[] }>);
  const setMapping = vi.fn(async (_n: string, m: Mapping) => {
    plugin.mapping = m;
    return { ok: true } as VendorResult<{}>;
  });
  const client: ObsClient = {
    listMappingSources,
    getMapping: vi.fn(async () => ({ ok: true, mapping: plugin.mapping, overlayEnabled: false }) as VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>),
    setMapping,
    setOverlay: vi.fn(async () => ({ ok: true }) as VendorResult<{}>),
    screenshot: async () => '',
    listInputs: async () => [],
    onMappingChanged: (cb) => {
      mappingCb = cb;
      return () => {
        mappingCb = null;
      };
    },
    onOverlayChanged: () => () => undefined,
  };
  const connection: ObsConnection = {
    client,
    connect: async () => undefined,
    disconnect: async () => undefined,
    onClose: (cb) => {
      closeCb = cb;
      return () => {
        closeCb = null;
      };
    },
  };
  return { connection, plugin, setMapping, listMappingSources, dropSocket: () => closeCb?.(1006), emit: (m: Mapping) => mappingCb?.('Map', m, undefined) };
};

const settle = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

/** Consumer-side composition: every effect is started and chained explicitly from events. */
const wire = (obs: ReturnType<typeof fakeObs>) => {
  const storage = { read: (_k: string, fallback: string) => fallback, write: () => undefined };
  const timers = { setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimer: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  const session = createObsSession({ connection: obs.connection, storage, ...timers });
  const sync = createMappingSync({ client: session.client, now: () => Date.now(), ...timers });
  const stops = [sync.watchRemote(), sync.startResync()];
  session.subscribe((e) => {
    if (e.type !== 'connChanged') return;
    if (e.conn.kind !== 'open') {
      sync.goOffline();
      return;
    }
    void session.reloadSources();
    void sync.reconnect();
  });
  session.start();
  return { session, sync, stops };
};

describe('consumer wiring of obs-session and mapping-sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const openMap = async (obs: ReturnType<typeof fakeObs>) => {
    const w = wire(obs);
    await settle();
    w.sync.open('Map', await w.sync.load('Map'));
    await settle();
    return w;
  };

  it('reloads sources and goes online from the connChanged open event', async () => {
    const obs = fakeObs(mapping(10));
    const { session, sync } = wire(obs);
    await settle();
    expect(session.getState().conn.kind).toBe('open');
    expect(obs.listMappingSources).toHaveBeenCalledTimes(1);
    expect(session.getState().sources).toHaveLength(1);
    expect(sync.getState().online).toBe(true);
  });

  it('keeps edits through a dropped socket and resends them after the retry reconnects', async () => {
    const obs = fakeObs(mapping(10));
    const { sync } = await openMap(obs);
    obs.dropSocket();
    expect(sync.getState().online).toBe(false);
    sync.dispatch({ type: 'setGrid', size: 20 });
    await settle(499);
    expect(obs.setMapping).not.toHaveBeenCalled();
    await settle(1);
    expect(obs.setMapping).toHaveBeenCalledTimes(1);
    expect(obs.setMapping.mock.calls[0]?.[1].grid.size).toBe(20);
    expect(sync.getState().editor?.mapping.grid.size).toBe(20);
  });

  it('reloads from the plugin after a reconnect with nothing unsent', async () => {
    const obs = fakeObs(mapping(10));
    const { sync } = await openMap(obs);
    obs.dropSocket();
    obs.plugin.mapping = mapping(40);
    await settle(500);
    expect(sync.getState().editor?.mapping.grid.size).toBe(40);
    expect(obs.setMapping).not.toHaveBeenCalled();
  });

  it('converges after the A / Z / B divergence (#2)', async () => {
    const obs = fakeObs(mapping(10));
    const { sync } = await openMap(obs);
    sync.dispatch({ type: 'setGrid', size: 20 });
    await settle();
    obs.emit(mapping(99));
    sync.dispatch({ type: 'setGrid', size: 30 });
    await settle();
    obs.emit(mapping(20));
    obs.emit(mapping(30));
    await settle();
    expect(sync.getState().editor?.mapping.grid.size).toBe(30);
    expect(sync.getState().editor?.needsResync).toBe(false);
    expect(obs.plugin.mapping.grid.size).toBe(30);
  });

  it('stops everything on dispose', async () => {
    const obs = fakeObs(mapping(10));
    const { session, sync } = await openMap(obs);
    sync.dispose();
    session.dispose();
    await settle(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
