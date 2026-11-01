import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { AUTH_FAILED_CODE, createObsConnection, type ObsClient } from './client';
import { nextConnState, type ConnEvent, type ConnState } from './connection';

export type ConnSettings = { url: string; password: string };

type Action = ConnEvent | 'stop';

// 'stop' is the user's explicit disconnect; it is not part of the pure machine
const reduce = (s: ConnState, a: Action): ConnState => (a === 'stop' ? { kind: 'idle' } : nextConnState(s, a));

const codeOf = (e: unknown): number | undefined => (typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'number' ? e.code : undefined);

const closeEvent = (code: number | undefined): ConnEvent => (code === AUTH_FAILED_CODE ? 'auth_error' : 'closed');

type Handle = { state: ConnState; client: ObsClient; connect: (s: ConnSettings) => void; disconnect: () => void };

/** Drives nextConnState with real timers: connects on `connecting`, schedules `retry` while `waiting`. */
export const useObsConnection = (initial: ConnSettings): Handle => {
  const conn = useMemo(() => createObsConnection(), []);
  const [state, dispatch] = useReducer(reduce, { kind: 'idle' } as ConnState);
  const [settings, setSettings] = useState<ConnSettings>(initial);

  const connect = useCallback((s: ConnSettings) => {
    setSettings(s);
    dispatch('connect');
  }, []);

  const disconnect = useCallback(() => {
    dispatch('stop');
    void conn.disconnect();
  }, [conn]);

  useEffect(() => {
    dispatch('connect'); // auto-connect with the stored settings on mount
  }, []);

  useEffect(() => conn.onClose((code) => dispatch(closeEvent(code))), [conn]);

  useEffect(() => {
    if (state.kind === 'connecting') {
      let cancelled = false;
      const run = async (): Promise<void> => {
        try {
          await conn.connect(settings.url, settings.password);
          if (!cancelled) dispatch('opened');
        } catch (e) {
          if (!cancelled) dispatch(closeEvent(codeOf(e)));
        }
      };
      void run();
      return () => {
        cancelled = true;
      };
    }
    if (state.kind === 'waiting') {
      const t = setTimeout(() => dispatch('retry'), state.retryInMs);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state, conn, settings]);

  return { state, client: conn.client, connect, disconnect };
};
