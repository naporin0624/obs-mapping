import { findParent, moveWithinParent, sortSurfacesByLayers } from '../model/layers';
import type { Mapping, Point, Surface } from '../model/mapping';
import { alignDeltas, distributeDeltas, itemsReference, translateSurface, type AlignMode } from '../geometry/align';
import { rectCorners, type Bounds } from '../geometry/rect';
import { followCorner } from '../layout/follow-corner';
import { layoutTree } from '../layout/layout-tree';
import { groupItems, groupProblem, selectedItemIds, ungroupItems } from './grouping';
import { freshId, idNumber } from './ids';
import { isLaidOut, movableItems, moveItem } from './items';
import { duplicateItems, removeItems } from './structure';
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
  | { type: 'group' }
  | { type: 'ungroup' }
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
  'group',
  'ungroup',
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

const pushPast = (past: readonly Mapping[], m: Mapping): Mapping[] => [...past, m].slice(-HISTORY_LIMIT);

/** Replace the mapping and record one undo step; a no-op when nothing changed. */
const commit = (s: EditorState, next: Mapping): EditorState => {
  if (next === s.mapping) return s;
  const laid = layoutTree(next);
  return canonicalJson(laid) === canonicalJson(s.mapping) ? s : { ...s, mapping: laid, past: pushPast(s.past, s.mapping), future: [] };
};

/** Replace the mapping without history (drag updates). */
const replaceLive = (s: EditorState, next: Mapping): EditorState => ({ ...s, mapping: layoutTree(next) });

const pruneSelection = (sel: Selection, m: Mapping): Selection => {
  const ids = new Set(m.surfaces.map((x) => x.id));
  const groups = new Set(m.groups.map((g) => g.id));
  return {
    surfaceIds: sel.surfaceIds.filter((id) => ids.has(id)),
    groupIds: sel.groupIds.filter((id) => groups.has(id)),
    corner: sel.corner !== null && ids.has(sel.corner.surfaceId) ? sel.corner : null,
  };
};

const moveAll = (m: Mapping, deltas: ReadonlyMap<string, Point>): Mapping => [...deltas].reduce((acc, [id, d]) => moveItem(acc, id, d), m);

const nudgedCorner = (m: Mapping, corner: NonNullable<Selection['corner']>, dx: number, dy: number): Mapping => {
  const p = m.surfaces.find((x) => x.id === corner.surfaceId)?.corners[corner.index];
  return p === undefined ? m : followCorner(m, corner.surfaceId, corner.index, [p[0] + dx, p[1] + dy]);
};

const nudged = (s: EditorState, dx: number, dy: number): Mapping => {
  const { corner } = s.selection;
  if (corner !== null) return nudgedCorner(s.mapping, corner, dx, dy);
  const items = movableItems(s.mapping, s.selection);
  return moveAll(s.mapping, new Map(items.map((i): [string, Point] => [i.id, [dx, dy]])));
};

const aligned = (s: EditorState, mode: AlignMode): Mapping => {
  const items = movableItems(s.mapping, s.selection);
  return moveAll(s.mapping, alignDeltas(items, mode, itemsReference(items, s.mapping.canvas)));
};

const distributed = (s: EditorState, axis: 'x' | 'y'): Mapping => moveAll(s.mapping, distributeDeltas(movableItems(s.mapping, s.selection), axis));

/** `toIndex` is a position in `surfaces`; it only applies when the surface there shares the parent. */
const moved = (m: Mapping, id: string, toIndex: number): Mapping => {
  const target = m.surfaces[Math.max(0, Math.min(m.surfaces.length - 1, toIndex))];
  const from = findParent(m.layers, id);
  const to = target === undefined ? null : findParent(m.layers, target.id);
  if (from === null || to === null || from.parentId !== to.parentId) return m;
  return sortSurfacesByLayers({ ...m, layers: moveWithinParent(m.layers, id, to.index) });
};

const withAppendedSurface = (m: Mapping, created: Surface): Mapping => ({ ...m, surfaces: [...m.surfaces, created], layers: [...m.layers, { surface: created.id }] });

const newSurface = (m: Mapping, source: string): Surface => {
  const id = freshId(m, 's');
  const width = m.canvas.width / 4;
  const height = m.canvas.height / 4;
  return {
    id,
    name: `面 ${idNumber(id) ?? id}`,
    type: 'quad',
    source,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    corners: rectCorners({ x: (m.canvas.width - width) / 2, y: (m.canvas.height - height) / 2, width, height }),
    visible: true,
  };
};

const grouped = (s: EditorState): EditorState => {
  if (groupProblem(s.mapping, s.selection) !== null) return s;
  const id = freshId(s.mapping, 'g');
  const next = groupItems(s.mapping, selectedItemIds(s.selection), id);
  if (next === null) return s;
  const committed = commit(s, next);
  return committed === s ? s : { ...committed, selection: { surfaceIds: [], groupIds: [id], corner: null } };
};

const ungrouped = (s: EditorState): EditorState => {
  if (s.selection.groupIds.length === 0) return s;
  const { mapping, childIds } = ungroupItems(s.mapping, s.selection.groupIds);
  const next = commit(s, mapping);
  if (next === s) return s;
  const kinds = new Set(next.mapping.groups.map((g) => g.id));
  return { ...next, selection: { surfaceIds: childIds.filter((id) => !kinds.has(id)), groupIds: childIds.filter((id) => kinds.has(id)), corner: null } };
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
  dragCorner: (s, a) => replaceLive(s, followCorner(s.mapping, a.surfaceId, a.index, a.to)),
  dragSurface: (s, a) =>
    isLaidOut(s.mapping, a.surfaceId)
      ? s
      : replaceLive(
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
  nudge: (s, a) => (s.selection.corner === null && movableItems(s.mapping, s.selection).length === 0 ? s : commit(s, nudged(s, a.dx, a.dy))),
  setCorner: (s, a) => commit(s, followCorner(s.mapping, a.surfaceId, a.index, a.to)),
  setBounds: (s, a) =>
    commit(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => ({ ...x, corners: rectCorners(a.bounds) })),
    ),
  align: (s, a) => (movableItems(s.mapping, s.selection).length < 1 ? s : commit(s, aligned(s, a.mode))),
  distribute: (s, a) => (movableItems(s.mapping, s.selection).length < 3 ? s : commit(s, distributed(s, a.axis))),
  addSurface: (s, a) => {
    const created = newSurface(s.mapping, a.source);
    const next = commit(s, withAppendedSurface(s.mapping, created));
    return { ...next, selection: { surfaceIds: [created.id], groupIds: [], corner: null } };
  },
  removeSelected: (s) => {
    const next = commit(s, removeItems(s.mapping, selectedItemIds(s.selection)));
    return next === s ? s : { ...next, selection: emptySelection() };
  },
  duplicateSelected: (s) => {
    const { mapping, newSurfaceIds, newGroupIds } = duplicateItems(s.mapping, selectedItemIds(s.selection));
    const next = commit(s, mapping);
    return next === s ? s : { ...next, selection: { surfaceIds: newSurfaceIds, groupIds: newGroupIds, corner: null } };
  },
  group: grouped,
  ungroup: ungrouped,
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
