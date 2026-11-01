import { atom, type Getter } from 'jotai';
import { atomWithRefresh } from 'jotai/utils';
import type { LoadResult, MappingSyncState } from '../../app/mapping-sync';
import type { Mapping } from '../../model/mapping';
import type { Action } from '../../editor/reducer';
import type { EditorState } from '../../editor/state';
import { commandAtom } from '../command';
import { instancesAtom } from '../instances';
import { selectedSourceAtom } from '../session';
import { streamAtom } from '../stream';

export type MappingView = { source: string; editor: EditorState; overlayEnabled: boolean };
type LoadedMapping = MappingView & { loaded: LoadResult };

const syncStream = streamAtom(
  (i) => i.sync.getState(),
  (i, notify) => i.sync.subscribe(notify),
);

/** Stream-only with a default: getState() until the first push. */
export const syncStateAtom = atom((get) => get(syncStream)?.value ?? get(instancesAtom).sync.getState());

export const overlayEnabledAtom = atom((get) => get(syncStateAtom).overlayEnabled);

type LiveState = MappingSyncState & { source: string; editor: EditorState };

const isLiveFor = (state: MappingSyncState | undefined, source: string | null): state is LiveState => state !== undefined && source !== null && state.editor !== null && state.source === source;

/** Hybrid step 1: one GetMapping for the selected source. Rejects on failure (ErrorBoundary); refresh = Retry. */
export const loadMappingAtom = atomWithRefresh(async (get): Promise<LoadedMapping | null> => {
  const source = get(selectedSourceAtom);
  if (source === null) return null;
  const loaded = await get(instancesAtom).sync.load(source);
  return { source, editor: loaded.editor, overlayEnabled: loaded.overlayEnabled, loaded };
});

/** Hybrid step 3: the stream's state once its source is open, else the single-fetch promise. Sync getter. */
export const mappingViewAtom = atom((get): MappingView | null | Promise<MappingView | null> => {
  const live = get(syncStateAtom);
  return isLiveFor(live, get(selectedSourceAtom)) ? live : get(loadMappingAtom);
});

export const hasLiveEditorAtom = atom((get) => isLiveFor(get(syncStateAtom), get(selectedSourceAtom)));

/** A failed load resolves to null here; LoadBoundary is what reports it. */
const loadedOrNull = async (get: Getter): Promise<LoadedMapping | null> => {
  try {
    return await get(loadMappingAtom);
  } catch {
    return null;
  }
};

/** Opens the loaded source as the active session; a no-op when it is already open, the selection moved on, or the load failed. */
export const activateMappingAtom = atom(null, async (get): Promise<void> => {
  const { sync } = get(instancesAtom);
  if (sync.getState().source === get(selectedSourceAtom)) return;
  const loaded = await loadedOrNull(get);
  if (loaded === null || loaded.source !== get(selectedSourceAtom)) return;
  sync.open(loaded.source, loaded.loaded);
});

export const retryLoadAtom = atom(null, (_get, set): void => set(loadMappingAtom));

/** On reconnect: re-fetch the selected source unless it is already open (sync.reconnect() covers that). */
export const reloadUnopenedMappingAtom = atom(null, (get, set): void => {
  if (!isLiveFor(get(syncStateAtom), get(selectedSourceAtom))) set(loadMappingAtom);
});

export const dispatchAtom = commandAtom((i, action: Action) => i.sync.dispatch(action));
export const setOverlayAtom = commandAtom((i, enabled: boolean) => i.sync.setOverlay(enabled));

/** Sends the import to the plugin and, only when accepted, reloads the view from it. */
export const importAtom = atom(null, async (get, _set, mapping: Mapping): Promise<boolean> => {
  const { sync } = get(instancesAtom);
  const accepted = await sync.applyImport(mapping);
  if (accepted) await sync.reload();
  return accepted;
});
