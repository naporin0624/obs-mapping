import type { createDrainSet } from './drain-set';
import type { SourceSession } from './source-session';

export type ConnectivityDeps = {
  initial: boolean;
  active: () => SourceSession | null;
  draining: ReturnType<typeof createDrainSet>;
  onChange: (online: boolean) => void;
};

/** The online flag and its fan-out to the active session and the old ones still delivering. */
export const createConnectivity = (d: ConnectivityDeps) => {
  let online = d.initial;

  const goOffline = (): void => {
    if (!online) return;
    online = false;
    d.active()?.goOffline();
    d.draining.each((s) => s.goOffline());
    d.onChange(online);
  };

  const reconnect = async (): Promise<void> => {
    const changed = !online;
    online = true;
    if (changed) d.onChange(online);
    d.draining.each((s) => void s.reconnect());
    await d.active()?.reconnect();
  };

  return { isOnline: (): boolean => online, goOffline, reconnect };
};
