import type { MappingSourceInfo, ObsClient, ObsConnection } from '../../obs/client';
import type { ConnState } from '../../obs/connection';
import { DEFAULT_URL, STORAGE_KEYS } from '../../storage';
import { createEmitter, type Emitter } from '../emitter';
import { createStore, type Store } from '../store';
import { createTerminator } from '../terminator';
import { createCatalog, type SourcesResult } from './catalog';
import { createConnDriver } from './conn-driver';
import type { ConnSettings } from './types';

export type { ConnSettings } from './types';
export type { MappingSourceInfo } from '../../obs/client';

export type ObsSessionState = {
  conn: ConnState;
  settings: ConnSettings;
  sources: readonly MappingSourceInfo[];
  sourcesError: string | null;
  inputs: readonly string[];
  selectedSource: string | null;
};

export type ObsSessionEvent =
  | { type: 'connChanged'; conn: ConnState }
  | { type: 'sourcesChanged'; sources: readonly MappingSourceInfo[]; error: string | null }
  | { type: 'inputsChanged'; inputs: readonly string[] }
  | { type: 'selectedSourceChanged'; source: string | null };

export type ObsSessionDeps = {
  connection: ObsConnection;
  storage: { read(key: string, fallback: string): string; write(key: string, value: string): void };
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

type Storage = ObsSessionDeps['storage'];

const nameOrNull = (stored: string): string | null => (stored === '' ? null : stored);

const initialState = (): ObsSessionState => ({
  conn: { kind: 'idle' },
  settings: { url: DEFAULT_URL, password: '' },
  sources: [],
  sourcesError: null,
  inputs: [],
  selectedSource: null,
});

const readSettings = (storage: Storage): ConnSettings => ({ url: storage.read(STORAGE_KEYS.url, DEFAULT_URL), password: storage.read(STORAGE_KEYS.password, '') });

const sameSettings = (a: ConnSettings, b: ConnSettings): boolean => a.url === b.url && a.password === b.password;

const sourcesPatch = (r: SourcesResult): Partial<ObsSessionState> => (r.ok ? { sources: r.sources, sourcesError: null } : { sourcesError: r.error });

const wireParts = (deps: Omit<ObsSessionDeps, 'storage'>, store: Store<ObsSessionState>, events: Emitter<ObsSessionEvent>) => {
  const catalog = createCatalog({
    client: () => deps.connection.client,
    onSources: (r) => {
      const s = store.patch(sourcesPatch(r));
      events.emit({ type: 'sourcesChanged', sources: s.sources, error: s.sourcesError });
    },
    onInputs: (inputs) => {
      store.patch({ inputs });
      events.emit({ type: 'inputsChanged', inputs });
    },
  });
  const driver = createConnDriver({
    connection: deps.connection,
    settings: () => store.get().settings,
    setTimer: deps.setTimer,
    clearTimer: deps.clearTimer,
    onChange: (conn) => {
      store.patch({ conn });
      events.emit({ type: 'connChanged', conn });
    },
  });
  return { catalog, driver };
};

const restoreStored = (storage: Storage, store: Store<ObsSessionState>, events: Emitter<ObsSessionEvent>): void => {
  const settings = readSettings(storage);
  if (!sameSettings(settings, store.get().settings)) store.patch({ settings });
  const source = nameOrNull(storage.read(STORAGE_KEYS.source, ''));
  if (source === store.get().selectedSource) return;
  store.patch({ selectedSource: source });
  events.emit({ type: 'selectedSourceChanged', source });
};

/**
 * Construction does nothing and getState() returns defaults until start() restores the stored settings and source.
 * start() connects with the stored settings; connect(settings) persists them and reconnects;
 * both retry with backoff until disconnect()/dispose(). Source and input lists load only via reloadSources()/reloadInputs().
 */
export const createObsSession = ({ connection, storage, setTimer, clearTimer }: ObsSessionDeps) => {
  const store = createStore(initialState());
  const events = createEmitter<ObsSessionEvent>();
  let disposed = false;

  const { catalog, driver } = wireParts({ connection, setTimer, clearTimer }, store, events);

  const start = (): void => {
    if (disposed) return;
    restoreStored(storage, store, events);
    driver.start();
  };

  const connect = (settings: ConnSettings): void => {
    if (disposed) return;
    storage.write(STORAGE_KEYS.url, settings.url);
    storage.write(STORAGE_KEYS.password, settings.password);
    store.patch({ settings });
    driver.reconnect();
  };

  const selectSource = (name: string | null): void => {
    if (disposed) return;
    storage.write(STORAGE_KEYS.source, name ?? '');
    store.patch({ selectedSource: name });
    events.emit({ type: 'selectedSourceChanged', source: name });
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    driver.dispose();
    catalog.dispose();
    events.clear();
    void connection.disconnect();
  };

  return {
    getState: store.get,
    get client(): ObsClient {
      return connection.client;
    },
    subscribe: events.subscribe,
    start,
    connect,
    disconnect: driver.stop,
    selectSource,
    reloadSources: catalog.reloadSources,
    reloadInputs: catalog.reloadInputs,
    isDisposed: (): boolean => disposed,
    dispose,
    ...createTerminator(dispose),
  };
};

export type ObsSession = ReturnType<typeof createObsSession>;
