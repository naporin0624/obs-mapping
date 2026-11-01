import type { Mapping } from '../model/mapping';

export type CornerIndex = 0 | 1 | 2 | 3;

export type Selection = {
  surfaceIds: string[];
  corner: { surfaceId: string; index: CornerIndex } | null;
};

export type EditorState = {
  mapping: Mapping;
  selection: Selection;
  dragging: boolean;
  past: Mapping[];
  future: Mapping[];
  /** canonicalJson of own sends not yet echoed back by the plugin, oldest first (max 32). */
  inFlight: readonly string[];
  pendingRemote: Mapping | null;
};

export const emptySelection = (): Selection => ({ surfaceIds: [], corner: null });

const canonicalize = (v: unknown): unknown => {
  if (typeof v === 'number') return Object.is(Number(v), -0) ? 0 : Number(v);
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canonicalize(x)]),
    );
  }
  return v;
};

/** Key-sorted, number-normalised JSON; equal for structurally equal mappings. */
export const canonicalJson = (m: Mapping): string => JSON.stringify(canonicalize(m));

export const initialEditorState = (mapping: Mapping): EditorState => ({
  mapping,
  selection: emptySelection(),
  dragging: false,
  past: [],
  future: [],
  inFlight: [],
  pendingRemote: null,
});
