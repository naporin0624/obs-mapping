export type UnderlaySettings = { visible: boolean; opacity: number };
export type StoredUnderlay = UnderlaySettings & { blob: Blob };

/** Persistence for the editor-only underlay image, keyed by Mapping source name. Every method may reject. */
export type UnderlayStore = {
  load: (source: string) => Promise<StoredUnderlay | null>;
  saveImage: (source: string, value: StoredUnderlay) => Promise<void>;
  saveSettings: (source: string, settings: UnderlaySettings) => Promise<void>;
  remove: (source: string) => Promise<void>;
};

const DB_NAME = 'surface-mapper';
const DB_VERSION = 2;
const IMAGES = 'underlay-images';
const SETTINGS = 'underlay-settings';
const DEFAULT_SETTINGS: UnderlaySettings = { visible: true, opacity: 0.6 };

const settle = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')));
  });

/** Resolves only when the transaction commits, so quota and commit failures reject. */
const committed = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.addEventListener('complete', () => resolve());
    tx.addEventListener('error', () => reject(tx.error ?? new Error('IndexedDB transaction failed')));
    tx.addEventListener('abort', () => reject(tx.error ?? new Error('IndexedDB transaction aborted')));
  });

const openDatabase = (factory: IDBFactory): Promise<IDBDatabase> => {
  const request = factory.open(DB_NAME, DB_VERSION);
  request.addEventListener('upgradeneeded', () => {
    const names = request.result.objectStoreNames;
    [IMAGES, SETTINGS].filter((name) => !names.contains(name)).forEach((name) => request.result.createObjectStore(name));
  });
  return settle(request);
};

const isBlob = (value: unknown): value is Blob => value instanceof Blob;

const isSettings = (value: unknown): value is UnderlaySettings =>
  typeof value === 'object' && value !== null && 'visible' in value && 'opacity' in value && typeof value.visible === 'boolean' && typeof value.opacity === 'number';

/** Opens the database on first use only; constructing the store does no I/O. */
export const createIdbUnderlayStore = (factory?: IDBFactory): UnderlayStore => {
  let opened: Promise<IDBDatabase> | undefined;
  const database = async (): Promise<IDBDatabase> => {
    try {
      opened ??= openDatabase(factory ?? indexedDB);
      return await opened;
    } catch (error) {
      opened = undefined;
      throw error;
    }
  };
  const begin = async (mode: IDBTransactionMode, names: string[]) => {
    const tx = (await database()).transaction(names, mode);
    return { tx, done: committed(tx) };
  };
  return {
    load: async (source) => {
      const { tx, done } = await begin('readonly', [IMAGES, SETTINGS]);
      const blob: IDBRequest<unknown> = tx.objectStore(IMAGES).get(source);
      const settings: IDBRequest<unknown> = tx.objectStore(SETTINGS).get(source);
      await done;
      return isBlob(blob.result) ? { blob: blob.result, ...(isSettings(settings.result) ? settings.result : DEFAULT_SETTINGS) } : null;
    },
    saveImage: async (source, { blob, visible, opacity }) => {
      const { tx, done } = await begin('readwrite', [IMAGES, SETTINGS]);
      tx.objectStore(IMAGES).put(blob, source);
      tx.objectStore(SETTINGS).put({ visible, opacity }, source);
      await done;
    },
    saveSettings: async (source, { visible, opacity }) => {
      const { tx, done } = await begin('readwrite', [SETTINGS]);
      tx.objectStore(SETTINGS).put({ visible, opacity }, source);
      await done;
    },
    remove: async (source) => {
      const { tx, done } = await begin('readwrite', [IMAGES, SETTINGS]);
      tx.objectStore(IMAGES).delete(source);
      tx.objectStore(SETTINGS).delete(source);
      await done;
    },
  };
};
