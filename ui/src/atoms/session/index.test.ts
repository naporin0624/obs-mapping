import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeObs, mapping } from '../../test/fake-obs';
import { lifecycleAtom } from '../lifecycle';
import { buildStore, settle } from '../../test/store-harness';
import { connAtom, inputsAtom, onlineAtom, reloadInputsAtom, selectedSourceAtom, selectSourceAtom, sessionStateAtom } from '.';

const noop = (): void => undefined;

describe('session atoms', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the default from getState() before anything is mounted', () => {
    const { store } = buildStore(fakeObs(mapping(10)));
    expect(store.get(connAtom)).toEqual({ kind: 'idle' });
    expect(store.get(onlineAtom)).toBe(false);
  });

  it('follows session events into derived atoms once mounted', async () => {
    const { store } = buildStore(fakeObs(mapping(10)));
    store.sub(sessionStateAtom, noop);
    store.sub(lifecycleAtom, noop);
    await settle();
    expect(store.get(onlineAtom)).toBe(true);
  });

  it('keeps the same selected-source value across unrelated events', async () => {
    const { store } = buildStore(fakeObs(mapping(10)));
    store.sub(selectedSourceAtom, noop);
    store.sub(lifecycleAtom, noop);
    store.set(selectSourceAtom, 'Map');
    expect(store.get(selectedSourceAtom)).toBe('Map');
    await settle();
    expect(store.get(selectedSourceAtom)).toBe('Map');
  });

  it('loads inputs through reloadInputsAtom', async () => {
    const obs = fakeObs(mapping(10));
    const { store, instances } = buildStore(obs);
    vi.spyOn(instances.session.client, 'listInputs').mockResolvedValue(['Cam']);
    store.sub(inputsAtom, noop);
    store.sub(lifecycleAtom, noop);
    await settle();
    await store.set(reloadInputsAtom);
    expect(store.get(inputsAtom)).toEqual(['Cam']);
  });
});
