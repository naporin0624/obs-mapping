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
  /** Error text of the last failed initial load (null when none); retry() loads again. */
  loadError: string | null;
  retry: () => void;
  toast: ToastMessage | null;
  dismissToast: () => void;
  /** Shows an error text in the toast. */
  reportError: (text: string) => void;
  /** Sends an imported mapping straight to the plugin (not undoable); on success the view reloads, on failure the plugin error is toasted. */
  applyImport: (mapping: Mapping) => Promise<boolean>;
};

type Shared = {
  /** A mapping object that came from the plugin (load/remote): the next mapping-change effect must not send it back. */
  skip: Mapping | null;
  /** Latest local mapping pushed to the queue and not yet answered. */
  unsent: Mapping | null;
  queue: SendQueue | null;
  online: boolean;
  /** This dock switched the overlay on for the current source (and so switches it off when leaving). */
  overlayOwned: boolean;
  /** The inFlight list a resync was already attempted for (avoids resyncing the same stale entries forever). */
  resynced: readonly string[] | null;
  /** Re-evaluates the divergence resync; called when `unsent` clears (no state change to trigger the effect). */
  recheck: (() => void) | null;
  resyncing: boolean;
};

type LoadCtl = { tick: number; setLoaded: (v: boolean) => void; setError: (e: string | null) => void; setOverlay: (v: boolean) => void };

type Env = { client: ObsClient; source: string; shared: RefObject<Shared>; dispatch: Dispatch<Action>; report: (text: string) => void };

/** Owns the send queue for the selected source (recreated on source change). */
const useQueue = ({ client, source, shared, dispatch, report }: Env): void => {
  useEffect(() => {
    const s = shared.current;
    s.unsent = null;
    let retired = false;
    s.queue = createSendQueue({
      send: async (m) => {
        // Rejecting (not resolving ok:false) tells the queue the connection is down: keep and resend later.
        if (!shared.current.online) throw new Error('offline');
        // a final flush for a source we are leaving must not leak into the next source's in-flight list
        if (!retired) dispatch({ type: 'sent', json: canonicalJson(m) });
        const r = await client.setMapping(source, m);
        // a transport failure can settle before the `online` flag flips: still keep the edit unsent
        if (!r.ok && (r.transport === true || !shared.current.online)) throw new Error(r.error);
        const sh = shared.current;
        if (sh.unsent === m) {
          sh.unsent = null;
          sh.recheck?.();
        }
        return r;
      },
      onError: report,
    });
    return () => {
      // a throttled edit still waiting for its slot belongs to the old source: deliver it before leaving
      retired = true;
      s.queue?.flush();
      s.queue?.dispose();
      s.queue = null;
    };
  }, [client, source, shared, dispatch, report]);
};

/** Initial load, and the reconnect rule: resend an unsent local change, otherwise reload from the plugin. */
const useLoad = (env: Env, online: boolean, ctl: LoadCtl): void => {
  const { tick, setLoaded, setError, setOverlay } = ctl;
  const { client, source, shared, dispatch, report } = env;
  useEffect(() => {
    setLoaded(false);
    setError(null);
    setOverlay(false); // the plugin's value arrives with the load
  }, [client, source, setLoaded, setError, setOverlay]);

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
        setError(r.error);
        report(r.error);
        return;
      }
      setError(null);
      const sh = shared.current;
      sh.skip = r.mapping;
      dispatch({ type: 'load', mapping: r.mapping });
      setOverlay(r.overlayEnabled);
      sh.overlayOwned = sh.overlayOwned && r.overlayEnabled;
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, source, online, tick, shared, dispatch, report, setLoaded, setError, setOverlay]);
};

/** Local edits go to the queue (throttled while dragging); plugin changes come back as `remote`. */
const useMappingFlow = (env: Env, state: EditorState, loaded: boolean, setOverlay: (v: boolean) => void): void => {
  const { client, source, shared, dispatch } = env;

  useEffect(() => {
    if (!loaded) return;
    const s = shared.current;
    if (state.mapping === s.skip) {
      s.skip = null;
      return;
    }
    s.unsent = state.mapping;
    s.queue?.enqueue(state.mapping, { dragging: state.dragging });
  }, [state.mapping, loaded, shared]);

  const wasDragging = useRef(false);
  useEffect(() => {
    if (wasDragging.current && !state.dragging) shared.current.queue?.flush();
    wasDragging.current = state.dragging;
  }, [state.dragging, shared]);

  useEffect(
    () =>
      client.onMappingChanged((name, mapping, overlayEnabled) => {
        if (name !== source) return;
        const sh = shared.current;
        sh.skip = mapping;
        dispatch({ type: 'remote', mapping });
        if (overlayEnabled !== undefined) setOverlay(overlayEnabled);
      }),
    [client, source, shared, dispatch, setOverlay],
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

/** After a foreign remote landed amid own sends, one getMapping once everything is answered settles on the plugin's copy. */
const useDivergenceResync = (env: Env, state: EditorState, online: boolean): void => {
  const { client, source, shared, dispatch } = env;
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    const settled = (): boolean => {
      const st = latest.current;
      return shared.current.online && st.needsResync && st.inFlight.length === 0 && !st.dragging && shared.current.unsent === null;
    };
    const check = (): void => {
      const sh = shared.current;
      if (cancelled || sh.resyncing || !settled()) return;
      sh.resyncing = true;
      void (async () => {
        const r = await client.getMapping(source);
        sh.resyncing = false;
        if (cancelled || !r.ok || !settled()) return;
        sh.skip = r.mapping;
        dispatch({ type: 'remote', mapping: r.mapping });
      })();
    };
    shared.current.recheck = check;
    check();
    return () => {
      cancelled = true;
      shared.current.recheck = null;
    };
  }, [client, source, online, state.needsResync, state.inFlight, state.dragging, shared, dispatch]);
};

const useResyncs = (env: Env, state: EditorState, online: boolean): void => {
  useResync(env, state, online);
  useDivergenceResync(env, state, online);
};

/** Selection changes go to the plugin without `enabled` (the plugin owns that flag); only the toggle sends it. */
const useOverlay = (env: Env, online: boolean, loaded: boolean, state: EditorState, setOverlay: (v: boolean) => void): void => {
  const { client, source } = env;
  useOverlayFollow(env, setOverlay);
  const { surfaceIds, corner } = state.selection;
  useEffect(() => {
    if (!online || !loaded || source === '') return;
    void client.setOverlay(source, { selectedSurfaceIds: surfaceIds, selectedCorner: corner });
  }, [client, source, online, loaded, surfaceIds, corner]);
};

/** The toggle button: the only place that sends `enabled`. A refusal puts the toggle back and is toasted. */
const useOverlayToggle = (env: Env, state: EditorState, setOverlay: (v: boolean) => void): ((enabled: boolean) => void) => {
  const { client, source, shared, report } = env;
  const selection = useRef(state.selection);
  useEffect(() => {
    selection.current = state.selection;
  }, [state.selection]);

  return useCallback(
    (enabled: boolean) => {
      if (!shared.current.online || source === '') return;
      shared.current.overlayOwned = enabled;
      setOverlay(enabled);
      const { surfaceIds, corner } = selection.current;
      void (async () => {
        const r = await client.setOverlay(source, { enabled, selectedSurfaceIds: surfaceIds, selectedCorner: corner });
        if (r.ok) return;
        shared.current.overlayOwned = false;
        setOverlay(!enabled);
        report(r.error);
      })();
    },
    [client, source, shared, report, setOverlay],
  );
};

/** Follows the plugin's overlay flag (property checkbox, other docks) and turns off what this dock turned on when leaving a source. */
const useOverlayFollow = (env: Env, setOverlay: (v: boolean) => void): void => {
  const { client, source, shared } = env;
  useEffect(
    () =>
      client.onOverlayChanged((name, enabled) => {
        if (name !== source) return;
        shared.current.overlayOwned = shared.current.overlayOwned && enabled;
        setOverlay(enabled);
      }),
    [client, source, shared, setOverlay],
  );

  useEffect(() => {
    const sh = shared.current;
    return () => {
      if (!sh.overlayOwned) return;
      sh.overlayOwned = false;
      void client.setOverlay(source, { enabled: false, selectedSurfaceIds: [], selectedCorner: null });
    };
  }, [client, source, shared]);
};

const useLoadState = () => {
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const [loadError, setError] = useState<string | null>(null);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { loaded, loadError, retry, ctl: { tick, setLoaded, setError } };
};

const useToast = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const report = useCallback((text: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, text })), []);
  const dismissToast = useCallback(() => setToast(null), []);
  return { toast, report, dismissToast };
};

/** Wires the editor reducer to the plugin: load, throttled send, remote echoes, overlay and reconnect. */
export const useSync = (client: ObsClient, source: string, online: boolean): Sync => {
  const [state, dispatch] = useReducer(reducer, EMPTY_MAPPING, initialEditorState);
  const [overlayEnabled, setOverlay] = useState(false);
  const { loaded, loadError, retry, ctl } = useLoadState();
  const { toast, report, dismissToast } = useToast();
  const shared = useRef<Shared>({ skip: null, unsent: null, queue: null, online, overlayOwned: false, resynced: null, recheck: null, resyncing: false });

  useEffect(() => {
    const sh = shared.current;
    sh.online = online;
  }, [online]);

  const env: Env = { client, source, shared, dispatch, report };
  useQueue(env);
  useLoad(env, online, { ...ctl, setOverlay });
  useMappingFlow(env, state, loaded, setOverlay);
  useResyncs(env, state, online);
  useOverlay(env, online, loaded, state, setOverlay);

  const setOverlayEnabled = useOverlayToggle(env, state, setOverlay);

  const applyImport = useCallback(
    async (mapping: Mapping): Promise<boolean> => {
      // the import supersedes whatever the queue was holding; drop it so it cannot overwrite the import later
      const sh = shared.current;
      const dropped = sh.unsent;
      sh.queue?.discard();
      sh.unsent = null;
      const r = await client.setMapping(source, mapping);
      if (!r.ok) {
        report(r.error);
        if (dropped !== null && shared.current.unsent === null) {
          shared.current.unsent = dropped;
          shared.current.queue?.enqueue(dropped, { dragging: false });
        }
        return false;
      }
      // the plugin's echo converges via `remote`; loading now updates the view at once and resets history
      shared.current.skip = mapping;
      dispatch({ type: 'load', mapping });
      return true;
    },
    [client, source, report],
  );

  return { state, dispatch, loaded, overlayEnabled, setOverlayEnabled, loadError, retry, toast, dismissToast, reportError: report, applyImport };
};
