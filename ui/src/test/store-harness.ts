import { createStore } from 'jotai';
import { vi } from 'vitest';
import type { FakeObs } from './fake-obs';
import { createInstances, instancesAtom } from '../atoms/instances';

export const settle = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

/** A jotai store wired to the fake OBS with fake timers; nothing is mounted yet. */
export const buildStore = (obs: FakeObs) => {
  const store = createStore();
  const instances = createInstances({
    connection: obs.connection,
    storage: { read: (_key, fallback) => fallback, write: () => undefined },
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });
  store.set(instancesAtom, instances);
  return { store, instances };
};
