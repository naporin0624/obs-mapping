import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_FAILED_CODE, type ObsClient, type ObsConnection, type VendorResult } from '../../obs/client';
import { DEFAULT_URL, STORAGE_KEYS } from '../../storage';
import { createObsSession, type ObsSessionEvent } from '.';

type FakeConn = {
  conn: ObsConnection;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  listMappingSources: ReturnType<typeof vi.fn>;
  listInputs: ReturnType<typeof vi.fn>;
  close: (code: number) => void;
  onClose: ReturnType<typeof vi.fn>;
  listening: () => boolean;
};

type FakeConnOptions = { replacesSocket?: boolean };

/** replacesSocket mimics obs-websocket-js: connect() closes the previous socket synchronously. */
const fakeConn = ({ replacesSocket = false }: FakeConnOptions = {}): FakeConn => {
  let closeCb: ((code: number) => void) | null = null;
  let hasSocket = false;
  const listMappingSources = vi.fn(async () => ({ ok: true, sources: [{ name: 'Map', width: 1920, height: 1080 }] }) as VendorResult<{ sources: { name: string; width: number; height: number }[] }>);
  const listInputs = vi.fn(async () => ['cam']);
  const connect = vi.fn(async (_url: string, _password: string) => {
    if (replacesSocket && hasSocket) closeCb?.(1000);
    hasSocket = true;
  });
  const disconnect = vi.fn(async () => {
    hasSocket = false;
  });
  const onClose = vi.fn((cb: (code: number) => void) => {
    closeCb = cb;
    return () => {
      closeCb = null;
    };
  });
  const client = { listMappingSources, listInputs } as unknown as ObsClient;
  const conn: ObsConnection = {
    client,
    connect,
    disconnect,
    onClose: onClose as ObsConnection['onClose'],
  };
  return { conn, connect, disconnect, listMappingSources, listInputs, close: (code) => closeCb?.(code), onClose, listening: () => closeCb !== null };
};

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    read: vi.fn((key: string, fallback: string): string => data.get(key) ?? fallback),
    write: (key: string, value: string): void => {
      data.set(key, value);
    },
  };
};

const setup = (stored: Record<string, string> = {}, options: FakeConnOptions = {}) => {
  const f = fakeConn(options);
  const storage = memoryStorage(stored);
  const session = createObsSession({
    connection: f.conn,
    storage,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  const events: ObsSessionEvent[] = [];
  session.subscribe((e) => events.push(e));
  return { f, storage, session, events };
};

const settle = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe('createObsSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle with defaults and no selected source', () => {
    const { session } = setup({ [STORAGE_KEYS.url]: 'ws://h:1', [STORAGE_KEYS.password]: 'pw', [STORAGE_KEYS.source]: 'Map' });
    expect(session.getState()).toMatchObject({ conn: { kind: 'idle' }, settings: { url: DEFAULT_URL, password: '' }, sources: [], sourcesError: null, inputs: [], selectedSource: null });
  });

  it('start() restores the stored settings and selected source', () => {
    const { session } = setup({ [STORAGE_KEYS.url]: 'ws://h:1', [STORAGE_KEYS.password]: 'pw', [STORAGE_KEYS.source]: 'Map' });
    session.start();
    expect(session.getState()).toMatchObject({ settings: { url: 'ws://h:1', password: 'pw' }, selectedSource: 'Map' });
  });

  it('start() emits selectedSourceChanged for the restored source', () => {
    const { session, events } = setup({ [STORAGE_KEYS.source]: 'Map' });
    session.start();
    expect(events).toContainEqual({ type: 'selectedSourceChanged', source: 'Map' });
  });

  it('start() keeps default settings when nothing is stored', () => {
    const { session } = setup();
    session.start();
    expect(session.getState().settings).toEqual({ url: DEFAULT_URL, password: '' });
  });

  it('start() does not overwrite a source selected before it', () => {
    const { session } = setup({ [STORAGE_KEYS.source]: 'Old' });
    session.selectSource('New');
    session.start();
    expect(session.getState().selectedSource).toBe('New');
  });

  it('auto-connects with the stored settings on start()', async () => {
    const { session, f } = setup({ [STORAGE_KEYS.url]: 'ws://h:1', [STORAGE_KEYS.password]: 'pw' });
    session.start();
    expect(session.getState().conn.kind).toBe('connecting');
    await settle();
    expect(f.connect).toHaveBeenCalledWith('ws://h:1', 'pw');
    expect(session.getState().conn.kind).toBe('open');
  });

  it('connect(settings) persists url and password', async () => {
    const { session, storage, f } = setup();
    session.connect({ url: 'ws://x:2', password: 'secret' });
    await settle();
    expect(storage.data.get(STORAGE_KEYS.url)).toBe('ws://x:2');
    expect(storage.data.get(STORAGE_KEYS.password)).toBe('secret');
    expect(f.connect).toHaveBeenCalledWith('ws://x:2', 'secret');
    expect(session.getState().settings).toEqual({ url: 'ws://x:2', password: 'secret' });
  });

  it('retries with exponential backoff while the connection keeps failing', async () => {
    const { session, f } = setup();
    f.connect.mockRejectedValue(new Error('refused'));
    session.start();
    await settle();
    expect(session.getState().conn).toEqual({ kind: 'waiting', attempt: 1, retryInMs: 500 });
    await settle(499);
    expect(f.connect).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(f.connect).toHaveBeenCalledTimes(2);
    expect(session.getState().conn).toEqual({ kind: 'waiting', attempt: 2, retryInMs: 1000 });
    await settle(1000);
    expect(session.getState().conn).toEqual({ kind: 'waiting', attempt: 3, retryInMs: 2000 });
  });

  it('retries after an open connection closes', async () => {
    const { session, f } = setup();
    session.start();
    await settle();
    f.close(1006);
    expect(session.getState().conn).toEqual({ kind: 'waiting', attempt: 1, retryInMs: 500 });
    await settle(500);
    expect(f.connect).toHaveBeenCalledTimes(2);
    expect(session.getState().conn.kind).toBe('open');
  });

  it('stops retrying after an authentication failure', async () => {
    const { session, f } = setup();
    f.connect.mockRejectedValue(Object.assign(new Error('auth'), { code: AUTH_FAILED_CODE }));
    session.start();
    await settle();
    expect(session.getState().conn.kind).toBe('auth_failed');
    await settle(60_000);
    expect(f.connect).toHaveBeenCalledTimes(1);
  });

  it('treats a 4009 close of an open connection as an auth failure', async () => {
    const { session, f } = setup();
    session.start();
    await settle();
    f.close(AUTH_FAILED_CODE);
    expect(session.getState().conn.kind).toBe('auth_failed');
  });

  it('disconnect() goes idle, cancels the retry timer and closes the socket', async () => {
    const { session, f } = setup();
    f.connect.mockRejectedValue(new Error('refused'));
    session.start();
    await settle();
    session.disconnect();
    expect(session.getState().conn.kind).toBe('idle');
    expect(f.disconnect).toHaveBeenCalledTimes(1);
    await settle(60_000);
    expect(f.connect).toHaveBeenCalledTimes(1);
  });

  it('ignores the close that follows an explicit disconnect', async () => {
    const { session, f } = setup();
    session.start();
    await settle();
    session.disconnect();
    f.close(1000);
    expect(session.getState().conn.kind).toBe('idle');
  });

  it('a late connect result after disconnect() does not reopen the session', async () => {
    const { session, f } = setup();
    let resolve: () => void = () => undefined;
    f.connect.mockImplementationOnce(() => new Promise<undefined>((r) => (resolve = () => r(undefined))));
    session.start();
    session.disconnect();
    resolve();
    await settle();
    expect(session.getState().conn.kind).toBe('idle');
  });

  it('emits connChanged with each new state', async () => {
    const { session, events } = setup();
    session.start();
    await settle();
    expect(events.filter((e) => e.type === 'connChanged').map((e) => e.type === 'connChanged' && e.conn.kind)).toEqual(['connecting', 'open']);
  });

  describe('construction has no effects', () => {
    it('construction, getState() and subscribe() touch nothing', async () => {
      const { session, f, events, storage } = setup();
      session.getState();
      await settle(60_000);
      expect(f.connect).not.toHaveBeenCalled();
      expect(f.onClose).not.toHaveBeenCalled();
      expect(storage.read).not.toHaveBeenCalled();
      expect(f.listMappingSources).not.toHaveBeenCalled();
      expect(f.listInputs).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(events).toEqual([]);
    });

    it('isDisposed() reports the lifecycle', () => {
      const { session } = setup();
      expect(session.isDisposed()).toBe(false);
      session.dispose();
      expect(session.isDisposed()).toBe(true);
    });
  });

  describe('close subscription is lazy (N1)', () => {
    it('subscribes when an attempt starts, once, and unsubscribes on disconnect()', async () => {
      const { session, f } = setup();
      session.start();
      await settle();
      session.connect({ url: 'ws://x', password: '' });
      await settle();
      expect(f.onClose).toHaveBeenCalledTimes(1);
      expect(f.listening()).toBe(true);
      session.disconnect();
      expect(f.listening()).toBe(false);
    });

    it('unsubscribes on dispose()', async () => {
      const { session, f } = setup();
      session.start();
      await settle();
      session.dispose();
      expect(f.listening()).toBe(false);
    });

    it('resubscribes when connecting again after disconnect()', async () => {
      const { session, f } = setup();
      session.start();
      await settle();
      session.disconnect();
      session.connect({ url: 'ws://x', password: '' });
      await settle();
      expect(f.listening()).toBe(true);
    });
  });

  describe('re-entrant start / connect (I1)', () => {
    it('start() twice reaches open once and never retries', async () => {
      const { session, f, events } = setup({}, { replacesSocket: true });
      session.start();
      session.start();
      await settle();
      await settle(60_000);
      expect(session.getState().conn.kind).toBe('open');
      expect(f.connect).toHaveBeenCalledTimes(1);
      expect(events.some((e) => e.type === 'connChanged' && e.conn.kind === 'waiting')).toBe(false);
    });

    it('connect(settings) while open reconnects once and stays open', async () => {
      const { session, f, events } = setup({}, { replacesSocket: true });
      session.start();
      await settle();
      events.length = 0;
      session.connect({ url: 'ws://y:3', password: 'p' });
      await settle();
      await settle(60_000);
      expect(session.getState().conn.kind).toBe('open');
      expect(f.connect).toHaveBeenCalledTimes(2);
      expect(events.some((e) => e.type === 'connChanged' && e.conn.kind === 'waiting')).toBe(false);
    });

    it('connect(settings) while connecting does not flap either', async () => {
      const { session, f } = setup({}, { replacesSocket: true });
      session.start();
      session.connect({ url: 'ws://y:3', password: 'p' });
      await settle();
      await settle(60_000);
      expect(session.getState().conn.kind).toBe('open');
      expect(f.connect).toHaveBeenCalledTimes(2);
    });

    it('a handshake rejected with 4009 still ends in auth_failed', async () => {
      const { session, f } = setup({}, { replacesSocket: true });
      f.connect.mockRejectedValue(Object.assign(new Error('auth'), { code: AUTH_FAILED_CODE }));
      session.start();
      await settle();
      expect(session.getState().conn.kind).toBe('auth_failed');
    });
  });

  describe('re-entrancy from subscribers (M3)', () => {
    it('a connChanged(connecting) subscriber calling disconnect() leaves no socket open', async () => {
      const { session, f } = setup();
      let socketOpen = false;
      f.connect.mockImplementation(async () => {
        socketOpen = true;
      });
      f.disconnect.mockImplementation(async () => {
        socketOpen = false;
      });
      session.subscribe((e) => {
        if (e.type === 'connChanged' && e.conn.kind === 'connecting') session.disconnect();
      });
      session.start();
      await settle();
      expect(session.getState().conn.kind).toBe('idle');
      expect(socketOpen).toBe(false);
    });
  });

  describe('nested emits are delivered in causal order (N2)', () => {
    it('later subscribers see connecting then idle when an earlier one disconnects', async () => {
      const { session } = setup();
      session.subscribe((e) => {
        if (e.type === 'connChanged' && e.conn.kind === 'connecting') session.disconnect();
      });
      const seen: string[] = [];
      session.subscribe((e) => {
        if (e.type === 'connChanged') seen.push(e.conn.kind);
      });
      session.start();
      await settle();
      expect(seen).toEqual(['connecting', 'idle']);
      expect(session.getState().conn.kind).toBe('idle');
    });
  });

  describe('sources and inputs', () => {
    it('does not reload sources or inputs by itself when the connection opens', async () => {
      const { session, f, events } = setup();
      session.start();
      await settle();
      expect(session.getState().conn.kind).toBe('open');
      expect(f.listMappingSources).not.toHaveBeenCalled();
      expect(f.listInputs).not.toHaveBeenCalled();
      expect(events.some((e) => e.type === 'sourcesChanged' || e.type === 'inputsChanged')).toBe(false);
    });

    it('reloadSources() and reloadInputs() fetch on demand and emit', async () => {
      const { session, f, events } = setup();
      await session.reloadSources();
      await session.reloadInputs();
      expect(f.listMappingSources).toHaveBeenCalledTimes(1);
      expect(session.getState().sources).toEqual([{ name: 'Map', width: 1920, height: 1080 }]);
      expect(session.getState().inputs).toEqual(['cam']);
      expect(events.map((e) => e.type)).toEqual(['sourcesChanged', 'inputsChanged']);
    });

    it('a consumer can reload from the connChanged open event', async () => {
      const { session, f } = setup();
      session.subscribe((e) => {
        if (e.type === 'connChanged' && e.conn.kind === 'open') void session.reloadSources();
      });
      session.start();
      await settle();
      f.close(1006);
      await settle(500);
      expect(f.listMappingSources).toHaveBeenCalledTimes(2);
    });

    it('keeps the error of a failed source listing and clears it on success', async () => {
      const { session, f } = setup();
      f.listMappingSources.mockResolvedValueOnce({ ok: false, error: 'plugin missing' });
      await session.reloadSources();
      expect(session.getState().sourcesError).toBe('plugin missing');
      await session.reloadSources();
      expect(session.getState().sourcesError).toBeNull();
      expect(session.getState().sources).toHaveLength(1);
    });

    it('reloadInputs() refreshes on demand', async () => {
      const { session, f } = setup();
      f.listInputs.mockResolvedValue(['a', 'b']);
      await session.reloadInputs();
      expect(session.getState().inputs).toEqual(['a', 'b']);
    });
  });

  describe('selected source', () => {
    it('persists the selection and emits selectedSourceChanged', () => {
      const { session, storage, events } = setup();
      session.selectSource('Map');
      expect(session.getState().selectedSource).toBe('Map');
      expect(storage.data.get(STORAGE_KEYS.source)).toBe('Map');
      expect(events).toContainEqual({ type: 'selectedSourceChanged', source: 'Map' });
    });

    it('clears the stored name when selecting null', () => {
      const { session, storage } = setup({ [STORAGE_KEYS.source]: 'Map' });
      session.selectSource(null);
      expect(session.getState().selectedSource).toBeNull();
      expect(storage.data.get(STORAGE_KEYS.source)).toBe('');
    });
  });

  describe('lifecycle', () => {
    it('subscribe returns an unsubscribe', async () => {
      const { session } = setup();
      const cb = vi.fn();
      const off = session.subscribe(cb);
      off();
      session.selectSource('Map');
      expect(cb).not.toHaveBeenCalled();
    });

    it('dispose() stops timers, disconnects and ignores later commands', async () => {
      const { session, f } = setup();
      f.connect.mockRejectedValue(new Error('refused'));
      session.start();
      await settle();
      session.dispose();
      expect(f.disconnect).toHaveBeenCalledTimes(1);
      await settle(60_000);
      expect(f.connect).toHaveBeenCalledTimes(1);
      session.connect({ url: 'ws://x', password: '' });
      expect(f.connect).toHaveBeenCalledTimes(1);
    });

    it('dispose() leaves no timers behind', async () => {
      const { session, f } = setup();
      f.connect.mockRejectedValue(new Error('refused'));
      session.start();
      await settle();
      expect(vi.getTimerCount()).toBe(1);
      session.dispose();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('terminate() disposes after a microtask', async () => {
      const { session, f } = setup();
      session.terminate();
      expect(f.disconnect).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(f.disconnect).toHaveBeenCalledTimes(1);
    });

    it('cancelTerminate() keeps the session alive', async () => {
      const { session, f } = setup();
      session.terminate();
      expect(session.cancelTerminate()).toBe(true);
      await Promise.resolve();
      expect(f.disconnect).not.toHaveBeenCalled();
      session.start();
      await settle();
      expect(session.getState().conn.kind).toBe('open');
    });

    it('cancelTerminate() reports false when nothing is pending', () => {
      expect(setup().session.cancelTerminate()).toBe(false);
    });
  });
});
