import type { Mapping } from '../../model/mapping';
import type { ObsClient } from '../../obs/client';
import type { Action } from '../../editor/reducer';
import type { EditorState } from '../../editor/state';
import { createDispatcher } from './dispatcher';
import { createOutbox } from './outbox';
import { createOverlayControl } from './overlay';
import { createReloader } from './reloader';
import { createResync } from './resync';
import type { RequestIds } from './request-ids';
import { createSessionState, type ResyncSnapshot } from './session-state';

export type LoadResult = { editor: EditorState; overlayEnabled: boolean; seq: number };

export type SessionEvent = { type: 'editorChanged'; editor: EditorState } | { type: 'overlayChanged'; enabled: boolean } | { type: 'error'; message: string };

export type SessionDeps = {
  client: ObsClient;
  source: string;
  initial: { editor: EditorState; overlayEnabled: boolean };
  online: boolean;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  idleMs: number;
  sendIntervalMs: number;
  nextRequestId: RequestIds;
  emit: (e: SessionEvent) => void;
  /** Called once a closed session has delivered its last unsent edit. */
  onDrained: () => void;
};

const PLUGIN_ACTIONS: ReadonlySet<Action['type']> = new Set(['load', 'remote', 'resynced', 'staleEcho', 'sent']);

const selectionChanged = (a: EditorState, b: EditorState): boolean =>
  a.selection.surfaceIds !== b.selection.surfaceIds || a.selection.groupIds !== b.selection.groupIds || a.selection.corner !== b.selection.corner;

type CommitParts = {
  overlay: ReturnType<typeof createOverlayControl>;
  reloader: ReturnType<typeof createReloader>;
  outbox: ReturnType<typeof createOutbox>;
  resync: ReturnType<typeof createResync>;
};

/** Side effects of one reduced action: selection to the plugin, local edits to the outbox, resync bookkeeping. */
const commit = (p: CommitParts, prev: EditorState, next: EditorState, action: Action): void => {
  const local = !PLUGIN_ACTIONS.has(action.type) && next.mapping !== prev.mapping;
  if (selectionChanged(prev, next)) p.overlay.sendSelection();
  if (local) {
    p.reloader.invalidate();
    p.outbox.submit(next.mapping, next.dragging);
  }
  if (prev.dragging && !next.dragging) p.outbox.flush();
  p.resync.update();
};

/** The collaborating parts of one source session, wired together. Starts nothing. */
const createSessionParts = (d: SessionDeps) => {
  const { client, source } = d;
  const state = createSessionState(d.initial.editor, d.online);
  // After close() a late refusal of the final flush is still worth showing, so errors skip the closed guard.
  const fail = (message: string): void => d.emit({ type: 'error', message });
  const timers = { setTimer: d.setTimer, clearTimer: d.clearTimer };

  const emitOverlay = (enabled: boolean): void => {
    if (!state.closed()) d.emit({ type: 'overlayChanged', enabled });
  };
  const overlay = createOverlayControl({ client, source, state, initial: d.initial.overlayEnabled, emit: emitOverlay, fail });
  const dispatcher = createDispatcher({
    state,
    onCommit: (prev, next, action) => commit({ overlay, reloader, outbox, resync }, prev, next, action),
    emit: (editor) => d.emit({ type: 'editorChanged', editor }),
  });
  const applyPlugin = (action: Action): void => dispatcher.dispatch(action);
  const read = (): ResyncSnapshot => ({ editor: state.editor(), online: state.online(), unsent: state.unsent() });
  const resync = createResync({ client, source, idleMs: d.idleMs, ...timers, read, applyRemote: (mapping) => applyPlugin({ type: 'resynced', mapping }) });
  const outbox = createOutbox({
    client,
    source,
    state,
    intervalMs: d.sendIntervalMs,
    now: d.now,
    ...timers,
    nextRequestId: d.nextRequestId,
    onSent: (requestId, json) => applyPlugin({ type: 'sent', requestId, json }),
    onSettled: resync.update,
    onDrained: d.onDrained,
    fail,
  });
  const reloader = createReloader({ client, source, state, applyLoad: (mapping) => applyPlugin({ type: 'load', mapping }), adoptOverlay: overlay.adopt, fail });

  return { state, dispatcher, overlay, outbox, reloader, resync, applyPlugin, fail };
};

type Parts = ReturnType<typeof createSessionParts>;

const reconnectLive = async (p: Parts): Promise<void> => {
  p.resync.update();
  p.overlay.sendSelection();
  if (p.state.unsent() === null) {
    await p.reloader.reload();
    return;
  }
  p.outbox.reconnect();
  await p.reloader.refreshOverlay();
};

const importMapping = async (p: Parts, client: ObsClient, source: string, mapping: Mapping): Promise<boolean> => {
  // the import supersedes whatever the queue was holding; drop it so it cannot overwrite the import later
  const dropped = p.outbox.discard();
  const r = await client.setMapping(source, mapping);
  if (r.ok) return true;
  p.fail(r.error);
  if (dropped !== null && p.state.unsent() === null && !p.state.closed()) p.outbox.submit(dropped, false);
  return false;
};

const goOffline = (p: Parts): void => {
  p.state.setOnline(false);
  p.reloader.invalidate();
  p.resync.update();
};

const reconnect = async (p: Parts): Promise<void> => {
  p.state.setOnline(true);
  if (p.state.closed()) p.outbox.reconnect();
  else await reconnectLive(p);
};

const begin = (p: Parts, cachedMapping: Mapping | undefined): void => {
  p.overlay.sendSelection();
  if (cachedMapping === undefined) p.dispatcher.run();
  else p.applyPlugin({ type: 'remote', mapping: cachedMapping, requestId: null });
  p.overlay.announce();
};

/** Flushes the outbox and detaches; true while an unanswered edit keeps it alive until delivered to this source. */
const close = (p: Parts): boolean => {
  p.state.markClosed();
  p.reloader.invalidate();
  p.resync.dispose();
  const draining = p.outbox.release();
  p.overlay.release();
  return draining;
};

/** Gives the unsent edit to the session that replaces this one and retires this one without sending. */
const handOver = (p: Parts): Mapping | null => {
  const unsent = p.outbox.discard();
  p.outbox.dispose();
  return unsent;
};

const followOverlay = (p: Parts, overlayEnabled: boolean | undefined): void => {
  if (overlayEnabled !== undefined) p.overlay.follow(overlayEnabled);
};

const applyRemote = (p: Parts, mapping: Mapping, overlayEnabled: boolean | undefined, requestId: string | null): void => {
  p.applyPlugin({ type: 'remote', mapping, requestId });
  followOverlay(p, overlayEnabled);
};

const applyStaleEcho = (p: Parts, overlayEnabled: boolean | undefined): void => {
  p.applyPlugin({ type: 'staleEcho' });
  followOverlay(p, overlayEnabled);
};

/**
 * Everything bound to one OBS source. Nothing runs until commanded: begin() sends the selection and announces the state,
 * dispatch() may send via the throttled queue, close() flushes (or drains) to this source.
 */
export const createSourceSession = (d: SessionDeps) => {
  const p = createSessionParts(d);
  return {
    source: d.source,
    getEditor: p.state.editor,
    getOverlayEnabled: p.overlay.enabled,
    dispatch: p.applyPlugin,
    begin: (cachedMapping: Mapping | undefined): void => begin(p, cachedMapping),
    goOffline: (): void => goOffline(p),
    reconnect: (): Promise<void> => reconnect(p),
    reload: p.reloader.reload,
    startResync: p.resync.start,
    setOverlay: p.overlay.toggle,
    applyRemote: (mapping: Mapping, overlayEnabled: boolean | undefined, requestId: string | null): void => applyRemote(p, mapping, overlayEnabled, requestId),
    applyStaleEcho: (overlayEnabled: boolean | undefined): void => applyStaleEcho(p, overlayEnabled),
    adoptOverlay: p.overlay.adopt,
    applyImport: (mapping: Mapping): Promise<boolean> => importMapping(p, d.client, d.source, mapping),
    close: (): boolean => close(p),
    handOver: (): Mapping | null => handOver(p),
    /** Takes over an edit another session of this source had not delivered yet. */
    adopt: (mapping: Mapping): void => p.outbox.submit(mapping, false),
    abandon: p.outbox.dispose,
  };
};

export type SourceSession = ReturnType<typeof createSourceSession>;
