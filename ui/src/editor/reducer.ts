import type { Mapping, Point, Surface } from '../model/mapping';
import { alignSurfaces, distributeSurfaces, translateSurface, type AlignMode } from '../geometry/align';
import { rectCorners, type Bounds } from '../geometry/rect';
import { canonicalJson, emptySelection, initialEditorState, type CornerIndex, type EditorState, type InFlightEntry, type Selection } from './state';

export type Action =
  | { type: 'load'; mapping: Mapping }
  | { type: 'select'; selection: Selection }
  | { type: 'dragStart' }
  | { type: 'dragCorner'; surfaceId: string; index: CornerIndex; to: Point }
  | { type: 'dragSurface'; surfaceId: string; dx: number; dy: number }
  | { type: 'dragEnd' }
  | { type: 'nudge'; dx: number; dy: number }
  | { type: 'setCorner'; surfaceId: string; index: CornerIndex; to: Point }
  | { type: 'setBounds'; surfaceId: string; bounds: Bounds }
  | { type: 'align'; mode: AlignMode }
  | { type: 'distribute'; axis: 'x' | 'y' }
  | { type: 'addSurface'; source: string }
  | { type: 'removeSelected' }
  | { type: 'duplicateSelected' }
  | { type: 'reorder'; surfaceId: string; toIndex: number }
  | { type: 'patchSurface'; surfaceId: string; patch: Partial<Pick<Surface, 'name' | 'source' | 'crop' | 'visible'>> }
  | { type: 'setGrid'; size: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'sent'; requestId: string; json: string }
  | { type: 'remote'; mapping: Mapping; requestId: string | null }
  | { type: 'resynced'; mapping: Mapping }
  | { type: 'staleEcho' };

const HISTORY_LIMIT = 100;
const GRID_MAX = 1024;
const COPY_OFFSET = 20;
const IN_FLIGHT_LIMIT = 32;

// Mapping-changing actions that are ignored while a drag is in progress.
const DRAG_BLOCKED: ReadonlySet<Action['type']> = new Set([
  'nudge',
  'setCorner',
  'setBounds',
  'align',
  'distribute',
  'addSurface',
  'removeSelected',
  'duplicateSelected',
  'reorder',
  'patchSurface',
  'setGrid',
]);

// ---- helpers -------------------------------------------------------------

const withSurfaces = (m: Mapping, surfaces: readonly Surface[]): Mapping => ({ ...m, surfaces });

const mapSurface = (m: Mapping, id: string, f: (s: Surface) => Surface): Mapping =>
  withSurfaces(
    m,
    m.surfaces.map((s) => (s.id === id ? f(s) : s)),
  );

const setCornerOf = (s: Surface, index: CornerIndex, to: Point): Surface => ({
  ...s,
  corners: s.corners.map((p, i) => (i === index ? to : p)) as unknown as Surface['corners'],
});

const pushPast = (past: readonly Mapping[], m: Mapping): Mapping[] => [...past, m].slice(-HISTORY_LIMIT);

/** Replace the mapping and record one undo step; a no-op when nothing changed. */
const commit = (s: EditorState, next: Mapping): EditorState => (canonicalJson(next) === canonicalJson(s.mapping) ? s : { ...s, mapping: next, past: pushPast(s.past, s.mapping), future: [] });

/** Replace the mapping without history (drag updates). */
const replaceLive = (s: EditorState, next: Mapping): EditorState => ({ ...s, mapping: next });

const pruneSelection = (sel: Selection, m: Mapping): Selection => {
  const ids = new Set(m.surfaces.map((x) => x.id));
  return {
    surfaceIds: sel.surfaceIds.filter((id) => ids.has(id)),
    corner: sel.corner !== null && ids.has(sel.corner.surfaceId) ? sel.corner : null,
  };
};

const nextSurfaceNumber = (m: Mapping): number =>
  m.surfaces.reduce((max, s) => {
    const hit = /^s-(\d+)$/.exec(s.id);
    return hit === null ? max : Math.max(max, Number(hit[1]));
  }, 0) + 1;

const nudged = (s: EditorState, dx: number, dy: number): Mapping => {
  const { corner, surfaceIds } = s.selection;
  if (corner !== null) {
    return mapSurface(s.mapping, corner.surfaceId, (x) => setCornerOf(x, corner.index, [x.corners[corner.index][0] + dx, x.corners[corner.index][1] + dy]));
  }
  return withSurfaces(
    s.mapping,
    s.mapping.surfaces.map((x) => (surfaceIds.includes(x.id) ? translateSurface(x, dx, dy) : x)),
  );
};

const duplicated = (m: Mapping, ids: readonly string[]): { mapping: Mapping; newIds: string[] } => {
  const start = nextSurfaceNumber(m);
  const sources = m.surfaces.filter((x) => ids.includes(x.id));
  const copies = sources.map((x, i) => ({ ...translateSurface(x, COPY_OFFSET, COPY_OFFSET), id: `s-${start + i}`, name: `${x.name} のコピー` }));
  const surfaces = m.surfaces.flatMap((x) => {
    const copy = copies.find((_, i) => sources[i] === x);
    return copy === undefined ? [x] : [x, copy];
  });
  return { mapping: withSurfaces(m, surfaces), newIds: copies.map((c) => c.id) };
};

const moved = (m: Mapping, id: string, toIndex: number): Mapping => {
  const item = m.surfaces.find((x) => x.id === id);
  if (item === undefined) return m;
  const rest = m.surfaces.filter((x) => x !== item);
  const at = Math.max(0, Math.min(rest.length, toIndex));
  return withSurfaces(m, [...rest.slice(0, at), item, ...rest.slice(at)]);
};

const newSurface = (m: Mapping, source: string): Surface => {
  const n = nextSurfaceNumber(m);
  const width = m.canvas.width / 4;
  const height = m.canvas.height / 4;
  return {
    id: `s-${n}`,
    name: `面 ${n}`,
    type: 'quad',
    source,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    corners: rectCorners({ x: (m.canvas.width - width) / 2, y: (m.canvas.height - height) / 2, width, height }),
    visible: true,
  };
};

const travel = (s: EditorState, from: 'past' | 'future'): EditorState => {
  const stack = s[from];
  const target = stack.at(-1);
  if (s.dragging || target === undefined) return s;
  const rest = stack.slice(0, -1);
  const patch = from === 'past' ? { past: rest, future: [...s.future, s.mapping] } : { past: pushPast(s.past, s.mapping), future: rest };
  return { ...s, ...patch, mapping: target, selection: pruneSelection(s.selection, target) };
};

const idEchoIndex = (inFlight: readonly InFlightEntry[], requestId: string): number => inFlight.findIndex((e) => e.requestId === requestId);

// An older plugin echoes no id: only the oldest send can be matched, by content.
const legacyEchoIndex = (inFlight: readonly InFlightEntry[], mapping: Mapping): number => (inFlight[0]?.json === canonicalJson(mapping) ? 0 : -1);

/** Index of the in-flight entry this remote acknowledges, or -1 when it is foreign. */
const ownEchoIndex = (inFlight: readonly InFlightEntry[], requestId: string | null, mapping: Mapping): number =>
  requestId === null ? legacyEchoIndex(inFlight, mapping) : idEchoIndex(inFlight, requestId);

/** The plugin copy fetched after quiet is the truth: local keeps its reference when equal, and no send is awaited any more. */
const reconciled = (s: EditorState, snapshot: Mapping): EditorState => {
  const same = canonicalJson(snapshot) === canonicalJson(s.mapping);
  const mapping = same ? s.mapping : snapshot;
  return { ...s, mapping, selection: same ? s.selection : pruneSelection(s.selection, snapshot), inFlight: [], needsResync: false };
};

// ---- handlers ------------------------------------------------------------

type Handlers = { [K in Action['type']]: (s: EditorState, a: Extract<Action, { type: K }>) => EditorState };

const handlers: Handlers = {
  load: (_s, a) => initialEditorState(a.mapping),
  select: (s, a) => ({ ...s, selection: a.selection }),
  dragStart: (s) => (s.dragging ? s : { ...s, dragging: true, past: pushPast(s.past, s.mapping), future: [] }),
  dragCorner: (s, a) =>
    replaceLive(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => setCornerOf(x, a.index, a.to)),
    ),
  dragSurface: (s, a) =>
    replaceLive(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => translateSurface(x, a.dx, a.dy)),
    ),
  dragEnd: (s) => {
    if (!s.dragging) return s;
    const last = s.past.at(-1);
    // A drag that ended where it started leaves no undo step.
    const unchanged = last !== undefined && canonicalJson(last) === canonicalJson(s.mapping);
    return { ...s, dragging: false, pendingRemote: null, past: unchanged ? s.past.slice(0, -1) : s.past };
  },
  nudge: (s, a) => (s.selection.corner === null && s.selection.surfaceIds.length === 0 ? s : commit(s, nudged(s, a.dx, a.dy))),
  setCorner: (s, a) =>
    commit(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => setCornerOf(x, a.index, a.to)),
    ),
  setBounds: (s, a) =>
    commit(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => ({ ...x, corners: rectCorners(a.bounds) })),
    ),
  align: (s, a) => commit(s, withSurfaces(s.mapping, alignSurfaces(s.mapping.surfaces, s.selection.surfaceIds, a.mode))),
  distribute: (s, a) => commit(s, withSurfaces(s.mapping, distributeSurfaces(s.mapping.surfaces, s.selection.surfaceIds, a.axis))),
  addSurface: (s, a) => {
    const created = newSurface(s.mapping, a.source);
    const next = commit(s, withSurfaces(s.mapping, [...s.mapping.surfaces, created]));
    return { ...next, selection: { surfaceIds: [created.id], corner: null } };
  },
  removeSelected: (s) => {
    const ids = s.selection.surfaceIds;
    const next = commit(
      s,
      withSurfaces(
        s.mapping,
        s.mapping.surfaces.filter((x) => !ids.includes(x.id)),
      ),
    );
    return next === s ? s : { ...next, selection: emptySelection() };
  },
  duplicateSelected: (s) => {
    const { mapping, newIds } = duplicated(s.mapping, s.selection.surfaceIds);
    const next = commit(s, mapping);
    return next === s ? s : { ...next, selection: { surfaceIds: newIds, corner: null } };
  },
  reorder: (s, a) => commit(s, moved(s.mapping, a.surfaceId, a.toIndex)),
  patchSurface: (s, a) =>
    commit(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => ({ ...x, ...a.patch })),
    ),
  setGrid: (s, a) => (Number.isFinite(a.size) && a.size > 0 && a.size <= GRID_MAX ? commit(s, { ...s.mapping, grid: { size: a.size } }) : s),
  undo: (s) => travel(s, 'past'),
  redo: (s) => travel(s, 'future'),
  sent: (s, a) => ({ ...s, inFlight: [...s.inFlight, { requestId: a.requestId, json: a.json }].slice(-IN_FLIGHT_LIMIT) }),
  remote: (s, a) => {
    if (s.dragging) return { ...s, pendingRemote: a.mapping };
    const at = ownEchoIndex(s.inFlight, a.requestId, a.mapping);
    // An own echo only consumes its in-flight entries; local edits made during the round trip must not flash back.
    // (An unmatched id of ours is a late echo: staleEcho flags the resync.)
    if (at >= 0) return { ...s, inFlight: s.inFlight.slice(at + 1) };
    return { ...s, mapping: a.mapping, selection: pruneSelection(s.selection, a.mapping), needsResync: s.inFlight.length > 0 };
  },
  resynced: (s, a) => (s.dragging ? { ...s, pendingRemote: a.mapping } : reconciled(s, a.mapping)),
  staleEcho: (s) => ({ ...s, needsResync: true }),
};

export const reducer = (s: EditorState, a: Action): EditorState => (s.dragging && DRAG_BLOCKED.has(a.type) ? s : (handlers[a.type] as (s: EditorState, a: Action) => EditorState)(s, a));
