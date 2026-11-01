import type { Mapping } from '../../model/mapping';
import type { ObsClient } from '../../obs/client';
import { initialEditorState, type EditorState } from '../../editor/state';
import type { createPluginFeed } from './plugin-feed';
import { createConnectivity } from './connectivity';
import { createDrainSet } from './drain-set';
import { createResyncMode } from './resync-mode';
import { createSourceSession, type LoadResult, type SessionEvent, type SourceSession } from './source-session';

export type SwitcherEvent = SessionEvent | { type: 'sourceChanged'; source: string | null } | { type: 'onlineChanged'; online: boolean };

export type SwitcherDeps = {
  client: ObsClient;
  feed: ReturnType<typeof createPluginFeed>;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  idleMs: number;
  sendIntervalMs: number;
  online: boolean;
  emit: (e: SwitcherEvent) => void;
};

type Opening = { source: string; editor: EditorState; overlayEnabled: boolean; online: boolean };

const createSession = (d: SwitcherDeps, draining: ReturnType<typeof createDrainSet>, o: Opening): SourceSession => {
  const session: SourceSession = createSourceSession({
    ...d,
    source: o.source,
    initial: { editor: o.editor, overlayEnabled: o.overlayEnabled },
    online: o.online,
    onDrained: () => draining.remove(session),
  });
  return session;
};

/** Owns the active source session, the old ones still delivering their last edit, and the online flag. */
export const createSwitcher = (d: SwitcherDeps) => {
  let active: SourceSession | null = null;
  const draining = createDrainSet();
  const connectivity = createConnectivity({ initial: d.online, active: () => active, draining, onChange: (online) => d.emit({ type: 'onlineChanged', online }) });
  const resyncMode = createResyncMode(() => active);

  const leave = (): void => {
    const leaving = active;
    resyncMode.detach();
    active = null;
    if (leaving === null) return;
    draining.add(leaving);
    if (!leaving.close()) draining.remove(leaving);
  };

  const activate = (source: string, loaded: LoadResult, handed: Mapping | null): void => {
    const updates = d.feed.since(source, loaded.seq);
    const editor = handed === null ? loaded.editor : initialEditorState(handed);
    const created = createSession(d, draining, { source, editor, overlayEnabled: updates.overlay ?? loaded.overlayEnabled, online: connectivity.isOnline() });
    active = created;
    resyncMode.attach(created);
    d.emit({ type: 'sourceChanged', source });
    if (active !== created) return;
    created.begin(handed === null ? updates.mapping : undefined);
    if (handed !== null) created.adopt(handed);
  };

  const open = (source: string, loaded: LoadResult): void => {
    if (active?.source === source) return;
    leave();
    activate(source, loaded, draining.takeOver(source));
  };

  const close = (): void => {
    if (active === null) return;
    leave();
    d.emit({ type: 'sourceChanged', source: null });
  };

  const dispose = (): void => {
    leave();
    resyncMode.dispose();
    draining.abandonAll();
  };

  return {
    current: (): SourceSession | null => active,
    isOnline: connectivity.isOnline,
    open,
    close,
    goOffline: connectivity.goOffline,
    reconnect: connectivity.reconnect,
    startResync: resyncMode.start,
    dispose,
  };
};
