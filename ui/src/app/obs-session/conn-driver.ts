import { AUTH_FAILED_CODE, type ObsConnection } from '../../obs/client';
import { nextConnState, type ConnEvent, type ConnState } from '../../obs/connection';
import type { ConnSettings } from './types';

export type ConnDriverDeps = {
  connection: ObsConnection;
  settings: () => ConnSettings;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  onChange: (conn: ConnState) => void;
};

const codeOf = (e: unknown): number | undefined => (typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'number' ? e.code : undefined);

const closeEvent = (code: number | undefined): ConnEvent => (code === AUTH_FAILED_CODE ? 'auth_error' : 'closed');

const createPending = (clearTimer: (handle: unknown) => void) => {
  let attempt = 0;
  let timer: unknown = null;
  return {
    token: (): number => attempt,
    hold: (handle: unknown): void => {
      timer = handle;
    },
    cancel: (): void => {
      attempt = attempt + 1;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
};

type AttemptDeps = ConnDriverDeps & { connecting: () => boolean; onEvent: (ev: ConnEvent) => void };

/** One connection attempt at a time: the connect call, its backoff timer and the close subscription (only while attempting). */
const createAttempts = (d: AttemptDeps) => {
  const pending = createPending(d.clearTimer);
  let offClose: (() => void) | null = null;

  const run = async (token: number): Promise<void> => {
    try {
      const { url, password } = d.settings();
      await d.connection.connect(url, password);
      if (token === pending.token()) d.onEvent('opened');
    } catch (e) {
      if (token === pending.token()) d.onEvent(closeEvent(codeOf(e)));
    }
  };

  // a close during the handshake reaches us through the connect() rejection instead
  const listenClose = (): void => {
    offClose ??= d.connection.onClose((code) => {
      if (!d.connecting()) d.onEvent(closeEvent(code));
    });
  };

  const unlisten = (): void => {
    offClose?.();
    offClose = null;
  };

  return {
    connect: (): void => {
      pending.cancel();
      listenClose();
      void run(pending.token());
    },
    wait: (ms: number): void => {
      pending.cancel();
      pending.hold(d.setTimer(() => d.onEvent('retry'), ms));
    },
    cancel: pending.cancel,
    unlisten,
  };
};

/** Connection state machine runner. start/reconnect begin an attempt and its backoff retries; stop() ends them. */
export const createConnDriver = (d: ConnDriverDeps) => {
  let conn: ConnState = { kind: 'idle' };
  let disposed = false;
  const attempts = createAttempts({ ...d, connecting: () => conn.kind === 'connecting', onEvent: (ev) => !disposed && transition(ev) });

  const enter = (next: ConnState): void => {
    if (next.kind === 'connecting') attempts.connect();
    else if (next.kind === 'waiting') attempts.wait(next.retryInMs);
    else attempts.cancel();
  };

  // effects first: a subscriber reacting to the change may issue its own command
  const setConn = (next: ConnState): void => {
    if (next === conn) return;
    conn = next;
    enter(next);
    d.onChange(next);
  };

  const transition = (ev: ConnEvent): void => setConn(nextConnState(conn, ev));

  const reconnect = (): void => {
    if (!disposed) transition('connect');
  };

  const start = (): void => {
    if (conn.kind === 'idle') reconnect();
  };

  const stop = (): void => {
    if (disposed) return;
    attempts.unlisten();
    setConn(conn.kind === 'idle' ? conn : { kind: 'idle' });
    void d.connection.disconnect();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    attempts.cancel();
    attempts.unlisten();
  };

  return { start, reconnect, stop, dispose };
};
