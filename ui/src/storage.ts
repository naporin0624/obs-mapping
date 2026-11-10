// localStorage access; every call is guarded because storage can throw (private windows, blocked data).
export const STORAGE_KEYS = {
  url: 'surface-mapper.url',
  password: 'surface-mapper.password',
  source: 'surface-mapper.source',
} as const;

export const DEFAULT_URL = 'ws://127.0.0.1:4455';

export const readStored = (key: string, fallback: string): string => {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeStored = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the value just is not remembered
  }
};
