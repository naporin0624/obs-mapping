import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayerNode } from '../../model/mapping';
import type { Action } from '../../editor/reducer';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import { fakeObs, mapping, type FakeObs } from '../../test/fake-obs';
import { collapsedGroupsAtom, toggleCollapsedAtom } from '../layers';
import { lifecycleAtom } from '../lifecycle';
import { selectedSourceAtom, selectSourceAtom } from '../session';
import { toastAtom } from '../toast';
import { buildStore, settle } from '../../test/store-harness';
import { activateMappingAtom, dispatchAtom, groupSelectionAtom, hasLiveEditorAtom, importAtom, mappingViewAtom, overlayEnabledAtom, retryLoadAtom } from '.';

const noop = (): void => undefined;

const mounted = async (obs: FakeObs) => {
  const built = buildStore(obs);
  built.store.sub(lifecycleAtom, noop);
  built.store.sub(selectedSourceAtom, noop);
  await settle();
  built.store.set(selectSourceAtom, 'Map');
  return built;
};

const gridOf = (view: unknown): number | undefined => (view as { editor?: { mapping: { grid: { size: number } } } } | null)?.editor?.mapping.grid.size;

describe('mapping hybrid atoms', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the single-fetch promise before the session opens, a plain value after', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    const first = store.get(mappingViewAtom);
    expect(first).toBeInstanceOf(Promise);
    expect(gridOf(await first)).toBe(10);
    await store.set(activateMappingAtom);
    const live = store.get(mappingViewAtom);
    expect(live).not.toBeInstanceOf(Promise);
    expect(gridOf(live)).toBe(10);
    expect(store.get(hasLiveEditorAtom)).toBe(true);
  });

  it('never returns a Promise for stream updates (local edit and remote change)', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    store.set(dispatchAtom, { type: 'setGrid', size: 20 });
    expect(store.get(mappingViewAtom)).not.toBeInstanceOf(Promise);
    expect(gridOf(store.get(mappingViewAtom))).toBe(20);
    await settle(100);
    obs.emit(mapping(30));
    await settle();
    expect(store.get(mappingViewAtom)).not.toBeInstanceOf(Promise);
    expect(gridOf(store.get(mappingViewAtom))).toBe(30);
  });

  it('does not fetch again when activating an already open source', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    await store.set(activateMappingAtom);
    expect(obs.getMapping).toHaveBeenCalledTimes(1);
  });

  it('rejects the single fetch on a plugin error and recovers through retry', async () => {
    const obs = fakeObs(mapping(10));
    obs.getMapping.mockResolvedValueOnce({ ok: false, error: 'down' });
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    await expect(store.get(mappingViewAtom)).rejects.toThrow('down');
    store.set(retryLoadAtom);
    expect(gridOf(await store.get(mappingViewAtom))).toBe(10);
  });

  it('reflects the overlay flag from the stream', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    store.sub(overlayEnabledAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    expect(store.get(overlayEnabledAtom)).toBe(false);
  });

  it('shows sync errors in the toast atom', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    obs.setMapping.mockResolvedValueOnce({ ok: false, error: 'boom' });
    store.set(dispatchAtom, { type: 'setGrid', size: 20 });
    await settle(100);
    expect(store.get(toastAtom)?.text).toBe('boom');
  });
});

describe('reconnect and remount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads a failed load once on reconnect, without Retry', async () => {
    const obs = fakeObs(mapping(10));
    obs.getMapping.mockResolvedValueOnce({ ok: false, error: 'socket closed' });
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    await expect(store.get(mappingViewAtom)).rejects.toThrow('socket closed');
    obs.dropSocket();
    await settle(500);
    expect(obs.getMapping).toHaveBeenCalledTimes(2);
    expect(gridOf(await store.get(mappingViewAtom))).toBe(10);
  });

  it('does not reload on reconnect when the source is already open', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    obs.dropSocket();
    await settle(500);
    expect(obs.getMapping).toHaveBeenCalledTimes(2);
  });

  it('shows the live edits, not the cached load, after the stream resets and remounts', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    const off = store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    store.set(dispatchAtom, { type: 'setGrid', size: 20 });
    off();
    expect(gridOf(store.get(mappingViewAtom))).toBe(20);
  });

  it('does not open a source the user already left while its load was pending', async () => {
    const obs = fakeObs(mapping(10));
    const release = Promise.withResolvers<void>();
    const reply = { ok: true, mapping: mapping(10), overlayEnabled: false } as const;
    obs.getMapping.mockImplementation(async () => {
      await release.promise;
      return reply;
    });
    const { store, instances } = await mounted(obs);
    store.sub(mappingViewAtom, noop);
    const pending = store.set(activateMappingAtom);
    store.set(selectSourceAtom, 'Other');
    release.resolve();
    await pending;
    expect(instances.sync.getState().source).toBeNull();
  });

  it('watches remote changes before the first load', async () => {
    const obs = fakeObs(mapping(10));
    const { store, instances } = buildStore(obs);
    const watch = vi.spyOn(instances.sync, 'watchRemote');
    const load = vi.spyOn(instances.sync, 'load');
    store.sub(lifecycleAtom, noop);
    store.sub(selectedSourceAtom, noop);
    await settle();
    store.set(selectSourceAtom, 'Map');
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    expect(load).toHaveBeenCalled();
    expect(watch.mock.invocationCallOrder[0]).toBeLessThan(load.mock.invocationCallOrder[0] ?? 0);
  });

  it('does not reject when activating after the selection moved to a failing source', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await mounted(obs);
    obs.getMapping.mockResolvedValueOnce({ ok: false, error: 'late' });
    store.set(selectSourceAtom, 'Other');
    await expect(store.set(activateMappingAtom)).resolves.toBeUndefined();
  });
});

describe('importAtom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const opened = async (obs: FakeObs) => {
    const built = await mounted(obs);
    built.store.sub(mappingViewAtom, noop);
    await built.store.get(mappingViewAtom);
    await built.store.set(activateMappingAtom);
    return built;
  };

  it('reloads from the plugin after a successful import', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await opened(obs);
    const loads = obs.getMapping.mock.calls.length;
    await expect(store.set(importAtom, mapping(40))).resolves.toBe(true);
    expect(obs.getMapping.mock.calls.length).toBe(loads + 1);
  });

  it('does not reload when the plugin refuses the import', async () => {
    const obs = fakeObs(mapping(10));
    const { store } = await opened(obs);
    const loads = obs.getMapping.mock.calls.length;
    obs.setMapping.mockResolvedValueOnce({ ok: false, error: 'nope' });
    await expect(store.set(importAtom, mapping(40))).resolves.toBe(false);
    expect(obs.getMapping.mock.calls.length).toBe(loads);
  });
});

describe('groupSelectionAtom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const opened = async () => {
    const nestedMap = { ...mapOf(surf('a', 0, 0), surf('b', 20, 0), surf('c', 40, 0)), groups: [groupOf('g-1')], layers: [sn('a'), gn('g-1', sn('b'), sn('c'))] };
    const { store, instances } = await mounted(fakeObs(nestedMap));
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    return { store, json: () => JSON.stringify(instances.sync.getState().editor?.mapping) };
  };
  const pick = (ids: string[]): Action => ({ type: 'select', selection: { surfaceIds: ids, groupIds: [], corner: null } });

  it('toasts once and leaves the mapping alone when parents differ', async () => {
    const { store, json } = await opened();
    store.set(dispatchAtom, pick(['a', 'b']));
    const before = json();
    store.set(groupSelectionAtom);
    expect(store.get(toastAtom)?.text).toBe('同じ階層のものを選んでください');
    expect(store.get(toastAtom)?.id).toBe(1);
    expect(json()).toBe(before);
  });
  it('does nothing, silently, with an empty selection', async () => {
    const { store, json } = await opened();
    const before = json();
    store.set(groupSelectionAtom);
    expect(store.get(toastAtom)).toBeNull();
    expect(json()).toBe(before);
  });
  it('groups a valid selection', async () => {
    const { store, json } = await opened();
    store.set(dispatchAtom, pick(['b', 'c']));
    store.set(groupSelectionAtom);
    const after = JSON.parse(json()) as { groups: { id: string }[]; layers: unknown[] };
    expect(after.groups.map((g) => g.id)).toEqual(['g-1', 'g-2']);
    expect(after.layers).toEqual([sn('a'), gn('g-1', gn('g-2', sn('b'), sn('c')))]);
  });
  it('does nothing while dragging', async () => {
    const { store, json } = await opened();
    store.set(dispatchAtom, pick(['a', 'b']));
    store.set(dispatchAtom, { type: 'dragStart' });
    const before = json();
    store.set(groupSelectionAtom);
    expect(store.get(toastAtom)).toBeNull();
    expect(json()).toBe(before);
  });
  it('does not group past the depth limit and leaves the mapping alone', async () => {
    const chain = Array.from({ length: 15 }, (_, i) => `g-${i + 1}`);
    const deep = {
      ...mapOf(surf('a', 0, 0)),
      groups: chain.map((id) => groupOf(id)),
      layers: [chain.reduceRight<LayerNode>((inner, id) => gn(id, inner), sn('a'))],
    };
    const { store, instances } = await mounted(fakeObs(deep));
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    store.set(dispatchAtom, pick(['a']));
    const before = JSON.stringify(instances.sync.getState().editor?.mapping);
    store.set(groupSelectionAtom);
    expect(store.get(toastAtom)?.text).toBe('これ以上深い階層にはできません（16 階層まで）');
    expect(JSON.stringify(instances.sync.getState().editor?.mapping)).toBe(before);
  });
});

describe('dispatchAtom collapsed groups', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a deleted group is forgotten, so a new group with the same id starts expanded', async () => {
    const map = { ...mapOf(surf('a', 0, 0), surf('b', 20, 0)), groups: [groupOf('g-1')], layers: [gn('g-1', sn('a')), sn('b')] };
    const { store } = await mounted(fakeObs(map));
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    store.set(toggleCollapsedAtom, 'g-1');
    store.set(dispatchAtom, { type: 'select', selection: { surfaceIds: [], groupIds: ['g-1'], corner: null } });
    store.set(dispatchAtom, { type: 'removeSelected' });
    expect(store.get(collapsedGroupsAtom).size).toBe(0);
  });

  it('keeps the collapsed state of groups that still exist', async () => {
    const map = { ...mapOf(surf('a', 0, 0)), groups: [groupOf('g-1')], layers: [gn('g-1', sn('a'))] };
    const { store } = await mounted(fakeObs(map));
    store.sub(mappingViewAtom, noop);
    await store.get(mappingViewAtom);
    await store.set(activateMappingAtom);
    store.set(toggleCollapsedAtom, 'g-1');
    store.set(dispatchAtom, { type: 'setGrid', size: 20 });
    expect([...store.get(collapsedGroupsAtom)]).toEqual(['g-1']);
  });
});
