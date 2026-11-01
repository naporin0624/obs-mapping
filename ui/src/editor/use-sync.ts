import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch, type RefObject } from 'react';
import type { Mapping } from '../model/mapping';
import type { ObsClient } from '../obs/client';
import { createSendQueue, type SendQueue } from './send-queue';
import { reducer, type Action } from './reducer';
import { canonicalJson, initialEditorState, type EditorState } from './state';

const RESYNC_IDLE_MS = 2000;

const EMPTY_MAPPING: Mapping = { version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: 10 }, surfaces: [] };

export type ToastMessage = { id: number; text: string };

export type Sync = {
  state: EditorState;
  dispatch: Dispatch<Action>;
  loaded: boolean;
  overlayEnabled: boolean;
  setOverlayEnabled: (v: boolean) => void;
  toast: ToastMessage | null;
  dismissToast: () => void;
};

type Shared = {
  /** A mapping object that came from the plugin (load/remote): the next mapping-change effect must not send it back. */
  skip: Mapping | null;
  /** Latest local mapping pushed to the queue and not yet answered. */
  unsent: Mapping | null;
  queue: SendQueue | null;
  online: boolean;
  /** The inFlight list a resync was already attempted for (avoids resyncing the same stale entries forever). */
  resynced: readonly string[] | null;
};

type Env = { client: ObsClient; source: string; shared: RefObject<Shared>; dispatch: Dispatch<Action>; report: (text: string) => void };

/** Owns the send queue for the selected source (recreated on source change). */
const useQueue = ({ client, source, shared, dispatch, report }: Env): void => {
  useEffect(() => {
    const s = shared.current;
    s.unsent = null;
    s.queue = createSendQueue({
      send: async (m) => {
        // Rejecting (not resolving ok:false) tells the queue the connection is down: keep and resend later.
        if (!shared.current.online) throw new Error('offline');
        dispatch({ type: 'sent', json: canonicalJson(m) });
        const r = await client.setMapping(source, m);
        if (!r.ok && !shared.current.online) throw new Error(r.error);
        const sh = shared.current;
        if (sh.unsent === m) sh.unsent = null;
        return r;
      },
      onError: report,
    });
    return () => {
      s.queue?.dispose();
      s.queue = null;
    };
  }, [client, source, shared, dispatch, report]);
};

/** Initial load, and the reconnect rule: resend an unsent local change, otherwise reload from the plugin. */
const useLoad = (env: Env, online: boolean, setLoaded: (v: boolean) => void): void => {
  const { client, source, shared, dispatch, report } = env;
  useEffect(() => {
    setLoaded(false);
  }, [client, source, setLoaded]);

  useEffect(() => {
    if (!online || source === '') return undefined;
    if (shared.current.unsent !== null) {
      shared.current.queue?.onReconnect();
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const r = await client.getMapping(source);
      if (cancelled) return;
      if (!r.ok) {
        report(r.error);
        return;
      }
      const sh = shared.current;
      sh.skip = r.mapping;
      dispatch({ type: 'load', mapping: r.mapping });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, source, online, shared, dispatch, report, setLoaded]);
};

/** Local edits go to the queue (throttled while dragging); plugin changes come back as `remote`. */
const useMappingFlow = (env: Env, state: EditorState, loaded: boolean): void => {
  const { client, source, shared, dispatch } = env;

  useEffect(() => {
    if (!loaded) return;
    const s = shared.current;
    if (state.mapping === s.skip) {
      s.skip = null;
      return;
    }
    s.unsent = state.mapping;
    // oxlint-disable-next-line no-restricted-properties -- SendQueue.push, not Array.prototype.push
    s.queue?.push(state.mapping, { dragging: state.dragging });
  }, [state.mapping, loaded, shared]);

  const wasDragging = useRef(false);
  useEffect(() => {
    if (wasDragging.current && !state.dragging) shared.current.queue?.flush();
    wasDragging.current = state.dragging;
  }, [state.dragging, shared]);

  useEffect(
    () =>
      client.onMappingChanged((name, mapping) => {
        if (name !== source) return;
        const sh = shared.current;
        sh.skip = mapping;
        dispatch({ type: 'remote', mapping });
      }),
    [client, source, shared, dispatch],
  );
};

/** Guards against lost echoes: sends still unanswered after 2 s idle are reconciled with the plugin's copy. */
const useResync = (env: Env, state: EditorState, online: boolean): void => {
  const { client, source, shared, dispatch } = env;
  useEffect(() => {
    if (!online || state.inFlight.length === 0 || state.dragging || shared.current.resynced === state.inFlight) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (shared.current.unsent !== null) return;
        const sh = shared.current;
        sh.resynced = state.inFlight;
        const r = await client.getMapping(source);
        if (cancelled || !r.ok) return;
        sh.skip = r.mapping;
        dispatch({ type: 'remote', mapping: r.mapping });
      })();
    }, RESYNC_IDLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, source, online, state.inFlight, state.mapping, state.dragging, shared, dispatch]);
};

const useOverlay = (client: ObsClient, source: string, online: boolean, loaded: boolean, state: EditorState, enabled: boolean): void => {
  const { surfaceIds, corner } = state.selection;
  useEffect(() => {
    if (!online || !loaded || source === '') return;
    void client.setOverlay(source, { enabled, selectedSurfaceIds: surfaceIds, selectedCorner: corner });
  }, [client, source, online, loaded, enabled, surfaceIds, corner]);
};

/** Wires the editor reducer to the plugin: load, throttled send, remote echoes, overlay and reconnect. */
export const useSync = (client: ObsClient, source: string, online: boolean): Sync => {
  const [state, dispatch] = useReducer(reducer, EMPTY_MAPPING, initialEditorState);
  const [loaded, setLoaded] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const shared = useRef<Shared>({ skip: null, unsent: null, queue: null, online, resynced: null });
  const report = useCallback((text: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, text })), []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const sh = shared.current;
    sh.online = online;
  }, [online]);

  const env: Env = { client, source, shared, dispatch, report };
  useQueue(env);
  useLoad(env, online, setLoaded);
  useMappingFlow(env, state, loaded);
  useResync(env, state, online);
  useOverlay(client, source, online, loaded, state, overlayEnabled);

  return { state, dispatch, loaded, overlayEnabled, setOverlayEnabled, toast, dismissToast };
};
