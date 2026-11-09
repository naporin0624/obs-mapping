import { atom, type Getter, type Setter } from 'jotai';
import type { MappingSync } from '../../app/mapping-sync';
import type { ObsSession, ObsSessionEvent } from '../../app/obs-session';
import { instancesAtom } from '../instances';
import { reloadUnopenedMappingAtom } from '../mapping';
import { reportErrorAtom } from '../toast';

const followConnection =
  (session: ObsSession, sync: MappingSync, set: Setter) =>
  (e: ObsSessionEvent): void => {
    if (e.type !== 'connChanged') return;
    if (e.conn.kind !== 'open') {
      sync.goOffline();
      return;
    }
    reloadCatalog(session)();
    void sync.reconnect();
    set(reloadUnopenedMappingAtom);
  };

const reloadCatalog = (session: ObsSession) => (): void => {
  void session.reloadSources();
  void session.reloadInputs();
};

/** The only place that starts anything; returns the cleanup that stops it all. */
const start = (get: Getter, set: Setter): (() => void) => {
  const { session, sync } = get(instancesAtom);
  session.cancelTerminate();
  sync.cancelTerminate();
  const stops = [sync.watchRemote(), sync.startResync(), session.client.onInventoryChanged(reloadCatalog(session))];
  const offConn = session.subscribe(followConnection(session, sync, set));
  const offErrors = sync.subscribe((e) => e.type === 'error' && set(reportErrorAtom, e.message));
  session.start();
  return (): void => {
    offConn();
    offErrors();
    for (const stop of stops) stop();
    sync.terminate();
    session.terminate();
  };
};

/** Mount once from App: useAtomValue(lifecycleAtom). */
export const lifecycleAtom = atom(null, (get, set, _command: 'start') => start(get, set));
lifecycleAtom.onMount = (setAtom) => setAtom('start');
