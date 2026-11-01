import type { StoredUnderlay, UnderlayStore } from './store';

/** In-memory stand-in for tests and the dev mock page. */
export const createMemoryUnderlayStore = (): UnderlayStore => {
  const records = new Map<string, StoredUnderlay>();
  return {
    load: async (source) => records.get(source) ?? null,
    saveImage: async (source, value) => void records.set(source, value),
    saveSettings: async (source, { visible, opacity }) => {
      const current = records.get(source);
      if (current !== undefined) records.set(source, { ...current, visible, opacity });
    },
    remove: async (source) => void records.delete(source),
  };
};
