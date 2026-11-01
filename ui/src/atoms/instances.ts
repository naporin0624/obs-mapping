import { atomWithLazy } from 'jotai/utils';
import { createMappingSync } from '../app/mapping-sync';
import { createObsSession, type ObsSessionDeps } from '../app/obs-session';
import { createObsConnection } from '../obs/client';
import { readStored, writeStored } from '../storage';

export type InstanceDeps = ObsSessionDeps & { now: () => number };

/** Construction is side-effect free: nothing connects or subscribes until lifecycleAtom is mounted. */
export const createInstances = (deps: InstanceDeps) => {
  const session = createObsSession(deps);
  const sync = createMappingSync({ client: session.client, now: deps.now, setTimer: deps.setTimer, clearTimer: deps.clearTimer });
  return { session, sync };
};

export type Instances = ReturnType<typeof createInstances>;

const realDeps = (): InstanceDeps => ({
  connection: createObsConnection(),
  storage: { read: readStored, write: writeStored },
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

/** Built per store on first read, so importing constructs nothing. Tests replace the value with store.set(instancesAtom, createInstances(fakeDeps)). */
export const instancesAtom = atomWithLazy<Instances>(() => createInstances(realDeps()));
