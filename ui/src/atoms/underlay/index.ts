import { atom, type Getter, type Setter } from 'jotai';
import { atomWithLazy } from 'jotai/utils';
import { messagesAtom } from '../../i18n/messages-atom';
import { createIdbUnderlayStore, type UnderlaySettings, type UnderlayStore } from '../../underlay/store';
import { selectedSourceAtom } from '../session';
import { reportErrorAtom } from '../toast';

export type UnderlayState = { kind: 'none'; source: string | null } | { kind: 'image'; source: string; blob: Blob; url: string; visible: boolean; opacity: number };

export type UnderlayDeps = { store: UnderlayStore; createUrl: (blob: Blob) => string; revokeUrl: (url: string) => void };

const DEFAULT_SETTINGS: UnderlaySettings = { visible: true, opacity: 0.6 };

/** Built on first read so importing does no I/O; tests replace it with store.set(underlayDepsAtom, fakes). */
export const underlayDepsAtom = atomWithLazy<UnderlayDeps>(() => ({
  store: createIdbUnderlayStore(),
  createUrl: (blob) => URL.createObjectURL(blob),
  revokeUrl: (url) => URL.revokeObjectURL(url),
}));

const stateAtom = atom<UnderlayState>({ kind: 'none', source: null });
const generationAtom = atom(0);

export const underlayAtom = atom((get) => get(stateAtom));

/** The underlay for the source the editor is showing; never another source's leftover. */
export const currentUnderlayAtom = atom((get): UnderlayState | null => {
  const state = get(stateAtom);
  return state.source === get(selectedSourceAtom) ? state : null;
});

const nextGeneration = (get: Getter, set: Setter): number => {
  const next = get(generationAtom) + 1;
  set(generationAtom, next);
  return next;
};

const replaceState = (get: Getter, set: Setter, next: UnderlayState): void => {
  const previous = get(stateAtom);
  if (previous.kind === 'image') get(underlayDepsAtom).revokeUrl(previous.url);
  set(stateAtom, next);
};

/** Shows the blob; a failing createObjectURL leaves the source empty and toasts instead of throwing. */
const showImage = (get: Getter, set: Setter, source: string, blob: Blob, settings: UnderlaySettings): boolean => {
  try {
    replaceState(get, set, { kind: 'image', source, blob, url: get(underlayDepsAtom).createUrl(blob), ...settings });
    return true;
  } catch {
    replaceState(get, set, { kind: 'none', source });
    set(reportErrorAtom, get(messagesAtom).underlayShowFailed);
    return false;
  }
};

/** Storage failures never break the session: the in-memory state stays and the user is told. */
const attempt = async <T>(set: Setter, message: string, run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run();
  } catch {
    set(reportErrorAtom, message);
    return undefined;
  }
};

export const loadUnderlayAtom = atom(null, async (get, set, source: string | null): Promise<void> => {
  const current = get(stateAtom);
  if (current.kind === 'image' && current.source === source) return;
  const generation = nextGeneration(get, set);
  replaceState(get, set, { kind: 'none', source });
  if (source === null) return;
  const stored = await attempt(set, get(messagesAtom).underlayLoadFailed, () => get(underlayDepsAtom).store.load(source));
  if (stored === undefined || stored === null || generation !== get(generationAtom)) return;
  showImage(get, set, source, stored.blob, stored);
});

export const chooseUnderlayAtom = atom(null, async (get, set, source: string, file: File): Promise<void> => {
  nextGeneration(get, set);
  if (!showImage(get, set, source, file, DEFAULT_SETTINGS)) return;
  await attempt(set, get(messagesAtom).underlaySaveFailed, () => get(underlayDepsAtom).store.saveImage(source, { blob: file, ...DEFAULT_SETTINGS }));
});

export const removeUnderlayAtom = atom(null, async (get, set): Promise<void> => {
  const { source } = get(stateAtom);
  nextGeneration(get, set);
  replaceState(get, set, { kind: 'none', source });
  if (source === null) return;
  await attempt(set, get(messagesAtom).underlayRemoveFailed, () => get(underlayDepsAtom).store.remove(source));
});

const saveSettings = async (get: Getter, set: Setter): Promise<void> => {
  const state = get(stateAtom);
  if (state.kind !== 'image') return;
  const { visible, opacity } = state;
  await attempt(set, get(messagesAtom).underlaySettingsFailed, () => get(underlayDepsAtom).store.saveSettings(state.source, { visible, opacity }));
};

/** Live preview while dragging; nothing is written until commitUnderlayOpacityAtom. */
export const setUnderlayOpacityAtom = atom(null, (get, set, opacity: number): void => {
  const state = get(stateAtom);
  if (state.kind === 'image') set(stateAtom, { ...state, opacity });
});

export const commitUnderlayOpacityAtom = atom(null, async (get, set, opacity: number): Promise<void> => {
  set(setUnderlayOpacityAtom, opacity);
  await saveSettings(get, set);
});

export const toggleUnderlayAtom = atom(null, async (get, set): Promise<void> => {
  const state = get(stateAtom);
  if (state.kind !== 'image') return;
  set(stateAtom, { ...state, visible: !state.visible });
  await saveSettings(get, set);
});
