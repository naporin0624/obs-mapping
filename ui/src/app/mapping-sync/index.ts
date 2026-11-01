import type { Mapping } from '../../model/mapping';
import type { ObsClient } from '../../obs/client';
import type { Action } from '../../editor/reducer';
import { initialEditorState, type EditorState } from '../../editor/state';
import { createEmitter } from '../emitter';
import { createTerminator } from '../terminator';
import { createPluginFeed } from './plugin-feed';
import { createRequestIds, isOwnRequestId, randomNonce } from './request-ids';
import type { LoadResult, SourceSession } from './source-session';
import { createSwitcher, type SwitcherDeps, type SwitcherEvent } from './switcher';

export type { LoadResult } from './source-session';

export type MappingSyncDeps = {
  client: ObsClient;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  resyncIdleMs?: number;
  sendIntervalMs?: number;
  /** Prefix of every requestId this instance sends; random by default so two docks never collide. */
  instanceNonce?: string;
  /** Initial connectivity; defaults to false until reconnect(). */
  online?: boolean;
};

export type MappingSyncState = { source: string | null; editor: EditorState | null; overlayEnabled: boolean; online: boolean };

export type MappingSyncEvent = SwitcherEvent;

const RESYNC_IDLE_MS = 2000;
const SEND_INTERVAL_MS = 33;

const stateOf = (s: SourceSession | null, online: boolean): MappingSyncState => ({
  source: s?.source ?? null,
  editor: s?.getEditor() ?? null,
  overlayEnabled: s?.getOverlayEnabled() ?? false,
  online,
});

const sameState = (a: MappingSyncState, b: MappingSyncState): boolean => a.source === b.source && a.editor === b.editor && a.overlayEnabled === b.overlayEnabled && a.online === b.online;

const isLateEcho = (s: SourceSession, requestId: string | null, nonce: string): boolean =>
  requestId !== null && isOwnRequestId(nonce, requestId) && !s.getEditor().inFlight.some((e) => e.requestId === requestId);

const routeToActive = (current: () => SourceSession | null, nonce: string) => ({
  onMapping: (source: string, mapping: Mapping, overlayEnabled: boolean | undefined, requestId: string | null): void => {
    const s = current();
    if (s?.source !== source) return;
    if (isLateEcho(s, requestId, nonce)) s.applyStaleEcho(overlayEnabled);
    else s.applyRemote(mapping, overlayEnabled, requestId);
  },
  onOverlay: (source: string, enabled: boolean): void => {
    const s = current();
    if (s?.source === source) s.adoptOverlay(enabled);
  },
});

/** Fetch only: one GetMapping, touching neither the active session nor any listener. */
const loader =
  (client: ObsClient, feed: ReturnType<typeof createPluginFeed>) =>
  async (source: string): Promise<LoadResult> => {
    const seq = feed.sequence(source);
    const r = await client.getMapping(source);
    if (!r.ok) throw new Error(r.error);
    return { editor: initialEditorState(r.mapping), overlayEnabled: r.overlayEnabled, seq };
  };

const whenAlive =
  (isDisposed: () => boolean) =>
  <A extends unknown[]>(fn: (...args: A) => void) =>
  (...args: A): void => {
    if (!isDisposed()) fn(...args);
  };

/** getState() keeps returning the same object until a field changes. */
const createSnapshot = (read: () => MappingSyncState, online: boolean) => {
  let snapshot: MappingSyncState = { source: null, editor: null, overlayEnabled: false, online };
  return (): MappingSyncState => {
    const next = read();
    if (!sameState(snapshot, next)) snapshot = next;
    return snapshot;
  };
};

const switcherDeps = (deps: MappingSyncDeps, nonce: string, feed: ReturnType<typeof createPluginFeed>, emit: (e: MappingSyncEvent) => void): SwitcherDeps => ({
  client: deps.client,
  feed,
  now: deps.now,
  setTimer: deps.setTimer,
  clearTimer: deps.clearTimer,
  idleMs: deps.resyncIdleMs ?? RESYNC_IDLE_MS,
  sendIntervalMs: deps.sendIntervalMs ?? SEND_INTERVAL_MS,
  nextRequestId: createRequestIds(nonce),
  online: deps.online ?? false,
  emit,
});

/**
 * Construction, getState() and load() start nothing. watchRemote() / startResync() are the only long-running
 * effects and return their stop; open() switches source (draining the old one), dispatch() may send.
 */
export const createMappingSync = (deps: MappingSyncDeps) => {
  const events = createEmitter<MappingSyncEvent>();
  let disposed = false;
  const getState = createSnapshot(() => stateOf(switcher.current(), switcher.isOnline()), deps.online ?? false);

  const emit = (e: MappingSyncEvent): void => {
    if (disposed) return;
    getState();
    events.emit(e);
  };

  const nonce = deps.instanceNonce ?? randomNonce();
  const feed = createPluginFeed({ client: deps.client, ...routeToActive(() => switcher.current(), nonce) });

  const switcher = createSwitcher(switcherDeps(deps, nonce, feed, emit));

  const dispose = (): void => {
    if (disposed) return;
    switcher.dispose();
    feed.stop();
    disposed = true;
    events.clear();
  };

  const live = whenAlive(() => disposed);

  return {
    getState,
    subscribe: events.subscribe,
    /** One GetMapping, no effects. watchRemote() must already be running so its seq lets open() catch up (I3 guarantee). */
    load: loader(deps.client, feed),
    /** Switches source: flushes (or drains) the old one to itself, applies changes seen since load(), sends the selection. */
    open: live(switcher.open),
    close: live(switcher.close),
    dispatch: (action: Action): void => switcher.current()?.dispatch(action),
    /** Marks offline: edits stay pending and nothing is sent until reconnect(). */
    goOffline: live(switcher.goOffline),
    /** Marks online, resends pending edits (also to a draining old source), then reloads or refreshes the overlay flag. */
    reconnect: (): Promise<void> => (!disposed ? switcher.reconnect() : Promise.resolve()),
    /** Applies the plugin's current mapping (GetMapping) to the active source, dropping the answer if an edit raced it. */
    reload: async (): Promise<void> => {
      await switcher.current()?.reload();
    },
    setOverlay: (enabled: boolean): void => switcher.current()?.setOverlay(enabled),
    applyImport: (mapping: Mapping): Promise<boolean> => switcher.current()?.applyImport(mapping) ?? Promise.resolve(false),
    /** Subscribes MappingChanged/OverlayChanged of all sources until the returned stop (idempotent). */
    watchRemote: (): (() => void) => feed.watch(),
    /** Runs the idle and divergence resyncs on the active source (and the ones opened later) until the returned stop. */
    startResync: switcher.startResync,
    isDisposed: (): boolean => disposed,
    dispose,
    ...createTerminator(dispose),
  };
};

export type MappingSync = ReturnType<typeof createMappingSync>;
