import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeObs, mapping } from '../../test/fake-obs';
import { buildStore, settle } from '../../test/store-harness';
import { connAtom, sourcesAtom } from '../session';
import { lifecycleAtom } from '.';

const noop = (): void => undefined;

describe('lifecycleAtom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the session, loads sources and goes online when mounted', async () => {
    const obs = fakeObs(mapping(10));
    const { store, instances } = buildStore(obs);
    store.sub(connAtom, noop);
    store.sub(sourcesAtom, noop);
    store.sub(lifecycleAtom, noop);
    await settle();
    expect(store.get(connAtom).kind).toBe('open');
    expect(obs.listMappingSources).toHaveBeenCalledTimes(1);
    expect(store.get(sourcesAtom)).toHaveLength(1);
    expect(instances.sync.getState().online).toBe(true);
  });

  it('starts watchRemote and startResync before the session connects', () => {
    const { store, instances } = buildStore(fakeObs(mapping(10)));
    const watch = vi.spyOn(instances.sync, 'watchRemote');
    const resync = vi.spyOn(instances.sync, 'startResync');
    const start = vi.spyOn(instances.session, 'start');
    store.sub(lifecycleAtom, noop);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(resync).toHaveBeenCalledTimes(1);
    expect(start.mock.invocationCallOrder[0]).toBeGreaterThan(watch.mock.invocationCallOrder[0] ?? Infinity);
  });

  it('goes offline on a dropped socket and reconnects through the same chain', async () => {
    const obs = fakeObs(mapping(10));
    const { store, instances } = buildStore(obs);
    store.sub(lifecycleAtom, noop);
    await settle();
    obs.dropSocket();
    expect(instances.sync.getState().online).toBe(false);
    await settle(500);
    expect(instances.sync.getState().online).toBe(true);
    expect(obs.listMappingSources).toHaveBeenCalledTimes(2);
  });

  it('reloads inputs and Mapping sources when the OBS inventory changes', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = buildStore(obs);
    store.sub(lifecycleAtom, noop);
    await settle();
    expect(obs.listInputs).toHaveBeenCalledTimes(1);
    expect(obs.listMappingSources).toHaveBeenCalledTimes(1);
    obs.changeInventory();
    await settle();
    expect(obs.listInputs).toHaveBeenCalledTimes(2);
    expect(obs.listMappingSources).toHaveBeenCalledTimes(2);
  });

  it('stops watching the OBS inventory when unmounted', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = buildStore(obs);
    const off = store.sub(lifecycleAtom, noop);
    await settle();
    expect(obs.watchingInventory()).toBe(true);
    off();
    expect(obs.watchingInventory()).toBe(false);
  });

  it('stops everything when unmounted', async () => {
    const obs = fakeObs(mapping(10));
    const { store, instances } = buildStore(obs);
    const off = store.sub(lifecycleAtom, noop);
    await settle();
    off();
    await settle(60_000);
    expect(instances.session.isDisposed()).toBe(true);
    expect(instances.sync.isDisposed()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one live session through a StrictMode mount, unmount, mount', async () => {
    const obs = fakeObs(mapping(10));
    const { store, instances } = buildStore(obs);
    const connect = vi.spyOn(obs.connection, 'connect');
    store.sub(lifecycleAtom, noop)();
    store.sub(lifecycleAtom, noop);
    await settle();
    expect(instances.session.isDisposed()).toBe(false);
    expect(instances.sync.isDisposed()).toBe(false);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(store.get(connAtom).kind).toBe('open');
  });
});
