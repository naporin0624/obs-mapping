import { fitsDepth, moveNodes, sortSurfacesByLayers, type NodeTarget } from '../model/layers';
import type { Group, Mapping, Mask, Point, Surface } from '../model/mapping';
import { MAX_SPACING } from '../model/validate-tree';
import { alignDeltas, distributeDeltas, itemsReference, translateSurface, type AlignMode } from '../geometry/align';
import { rectCorners, type Bounds } from '../geometry/rect';
import { tileSurfaces, type LineTile, type TileGrid } from '../geometry/tile';
import { followCorner } from '../layout/follow-corner';
import { layoutTree } from '../layout/layout-tree';
import { groupItems, groupProblem, selectedItemIds, ungroupItems } from './grouping';
import { freshId, idNumber } from './ids';
import { isLaidOut, movableItems, moveItem, tileableSurfaceIds } from './items';
import type { Naming } from './naming';
import { duplicateItems, removeItems } from './structure';
import { removeVertex } from './mask-edit';
import { tiledGroup } from './tile-group';
import { canonicalJson, emptySelection, initialEditorState, type CornerIndex, type EditorState, type InFlightEntry, type Selection, type ShapeEdit } from './state';

type NamedType = 'addSurface' | 'duplicateSelected' | 'group';

/** What the UI dispatches: the actions that create items do not carry their naming yet. */
export type UiAction = Action extends infer A ? (A extends { type: NamedType } ? Omit<A, 'naming'> : A) : never;

export type Action =
  | { type: 'load'; mapping: Mapping }
  | { type: 'select'; selection: Selection }
  | { type: 'dragStart' }
  | { type: 'dragCorner'; surfaceId: string; index: CornerIndex; to: Point }
  | { type: 'dragSurface'; surfaceId: string; dx: number; dy: number }
  | { type: 'dragItems'; ids: readonly string[]; dx: number; dy: number }
  | { type: 'dragEnd' }
  | { type: 'nudge'; dx: number; dy: number }
  | { type: 'setCorner'; surfaceId: string; index: CornerIndex; to: Point }
  | { type: 'setBounds'; surfaceId: string; bounds: Bounds }
  | { type: 'align'; mode: AlignMode }
  | { type: 'distribute'; axis: 'x' | 'y' }
  | ({ type: 'tile' } & TileGrid)
  | ({ type: 'tileGroup'; groupId: string } & LineTile)
  | { type: 'addSurface'; source: string; naming: Naming }
  | { type: 'removeSelected' }
  | { type: 'duplicateSelected'; naming: Naming }
  | { type: 'group'; naming: Naming }
  | { type: 'ungroup' }
  | { type: 'moveNodes'; ids: string[]; target: NodeTarget }
  | { type: 'patchGroup'; groupId: string; patch: Partial<Pick<Group, 'name' | 'visible' | 'layout'>> }
  | { type: 'patchSurface'; surfaceId: string; patch: Partial<Pick<Surface, 'name' | 'source' | 'crop' | 'visible'>> }
  | { type: 'setGrid'; size: number }
  | { type: 'setMask'; surfaceId: string; mask: Mask | null }
  | { type: 'dragMask'; surfaceId: string; mask: Mask }
  | { type: 'enterShapeEdit'; surfaceId: string }
  | { type: 'exitShapeEdit' }
  | { type: 'selectVertex'; index: number | null }
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
  'tile',
  'tileGroup',
  'addSurface',
  'removeSelected',
  'duplicateSelected',
  'group',
  'ungroup',
  'moveNodes',
  'patchGroup',
  'patchSurface',
  'setGrid',
  'setMask',
  'enterShapeEdit',
  'exitShapeEdit',
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

const withMask = (s: Surface, mask: Mask | null): Surface => {
  const { mask: _previous, ...rest } = s;
  return mask === null ? rest : { ...rest, mask };
};

const isSoleSelection = (sel: Selection, surfaceId: string): boolean => sel.groupIds.length === 0 && sel.surfaceIds.length === 1 && sel.surfaceIds[0] === surfaceId;

const vertexCount = (mask: Mask | undefined): number => (mask?.type === 'polygon' ? mask.points.length : 0);

/** Drops the shape edit (or just its vertex) once the surface, mask or selection no longer supports it. */
const pruneShapeEdit = (s: EditorState): EditorState => {
  const edit = s.shapeEdit;
  if (edit === null) return s;
  const mask = s.mapping.surfaces.find((x) => x.id === edit.surfaceId)?.mask;
  if (mask === undefined || !isSoleSelection(s.selection, edit.surfaceId)) return { ...s, shapeEdit: null };
  const vertexValid = edit.vertex === null || (Number.isInteger(edit.vertex) && edit.vertex >= 0 && edit.vertex < vertexCount(mask));
  return vertexValid ? s : { ...s, shapeEdit: { ...edit, vertex: null } };
};

const enteredShapeEdit = (s: EditorState, surfaceId: string): EditorState => {
  const pruned = pruneShapeEdit({ ...s, shapeEdit: { surfaceId, vertex: null } });
  return pruned.shapeEdit === null ? s : { ...pruned, selection: { ...pruned.selection, corner: null } };
};

const withVertex = (s: EditorState, vertex: number | null): EditorState => (s.shapeEdit === null ? s : { ...s, shapeEdit: { ...s.shapeEdit, vertex } });

const verticesRemoved = (s: EditorState, edit: ShapeEdit & { vertex: number }): EditorState => {
  const mask = s.mapping.surfaces.find((x) => x.id === edit.surfaceId)?.mask;
  const committed =
    mask?.type === 'polygon'
      ? commit(
          s,
          mapSurface(s.mapping, edit.surfaceId, (x) => withMask(x, removeVertex(mask, edit.vertex))),
        )
      : s;
  return { ...committed, shapeEdit: { ...edit, vertex: null } };
};

const removedSelected = (s: EditorState): EditorState => {
  if (s.shapeEdit !== null) return s.shapeEdit.vertex === null ? s : verticesRemoved(s, { ...s.shapeEdit, vertex: s.shapeEdit.vertex });
  const next = commit(s, removeItems(s.mapping, selectedItemIds(s.selection)));
  return next === s ? s : { ...next, selection: emptySelection() };
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

const isCount = (n: number): boolean => Number.isInteger(n) && n >= 1;

const isTileGrid = ({ cols, rows, gap }: TileGrid): boolean => isCount(cols) && isCount(rows) && Number.isFinite(gap) && gap >= 0;

const tiled = (s: EditorState, grid: TileGrid): Mapping => {
  const ids = tileableSurfaceIds(s.mapping, s.selection);
  if (ids.length === 0 || !isTileGrid(grid)) return s.mapping;
  const { width, height } = s.mapping.canvas;
  return withSurfaces(s.mapping, tileSurfaces(s.mapping.surfaces, ids, { x: 0, y: 0, width, height }, grid));
};

const movedNodes = (m: Mapping, ids: readonly string[], target: NodeTarget): Mapping => {
  if (!fitsDepth(m.layers, ids, target.parentId)) return m;
  const layers = moveNodes(m.layers, ids, target);
  return layers === m.layers ? m : sortSurfacesByLayers({ ...m, layers });
};

const clampSpacing = (value: number, current: number): number => (Number.isFinite(value) ? Math.max(0, Math.min(MAX_SPACING, value)) : current);

const mergedGroup = (g: Group, patch: Partial<Pick<Group, 'name' | 'visible' | 'layout'>>): Group => ({
  ...g,
  name: patch.name === undefined || patch.name === '' ? g.name : patch.name,
  visible: patch.visible ?? g.visible,
  layout: patch.layout === undefined ? g.layout : { ...patch.layout, gap: clampSpacing(patch.layout.gap, g.layout.gap), padding: clampSpacing(patch.layout.padding, g.layout.padding) },
});

const patchedGroup = (m: Mapping, groupId: string, patch: Partial<Pick<Group, 'name' | 'visible' | 'layout'>>): Mapping => ({
  ...m,
  groups: m.groups.map((g) => (g.id === groupId ? mergedGroup(g, patch) : g)),
});

const withAppendedSurface = (m: Mapping, created: Surface): Mapping => ({ ...m, surfaces: [...m.surfaces, created], layers: [...m.layers, { surface: created.id }] });

const newSurface = (m: Mapping, source: string, naming: Naming): Surface => {
  const id = freshId(m, 's');
  const width = m.canvas.width / 4;
  const height = m.canvas.height / 4;
  return {
    id,
    name: naming.surface(String(idNumber(id) ?? id)),
    type: 'quad',
    source,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    corners: rectCorners({ x: (m.canvas.width - width) / 2, y: (m.canvas.height - height) / 2, width, height }),
    visible: true,
  };
};

const grouped = (s: EditorState, naming: Naming): EditorState => {
  if (groupProblem(s.mapping, s.selection) !== null) return s;
  const id = freshId(s.mapping, 'g');
  const next = groupItems(s.mapping, selectedItemIds(s.selection), id, naming.group);
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
  dragItems: (s, a) => replaceLive(s, moveAll(s.mapping, new Map(a.ids.map((id): [string, Point] => [id, [a.dx, a.dy]])))),
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
  tile: (s, { cols, rows, gap }) => commit(s, tiled(s, { cols, rows, gap })),
  tileGroup: (s, { groupId, direction, gap }) => commit(s, tiledGroup(s.mapping, groupId, { direction, gap })),
  addSurface: (s, a) => {
    const created = newSurface(s.mapping, a.source, a.naming);
    const next = commit(s, withAppendedSurface(s.mapping, created));
    return { ...next, selection: { surfaceIds: [created.id], groupIds: [], corner: null } };
  },
  removeSelected: removedSelected,
  duplicateSelected: (s, a) => {
    const { mapping, newSurfaceIds, newGroupIds } = duplicateItems(s.mapping, selectedItemIds(s.selection), a.naming.copy);
    const next = commit(s, mapping);
    return next === s ? s : { ...next, selection: { surfaceIds: newSurfaceIds, groupIds: newGroupIds, corner: null } };
  },
  group: (s, a) => grouped(s, a.naming),
  ungroup: ungrouped,
  moveNodes: (s, a) => commit(s, movedNodes(s.mapping, a.ids, a.target)),
  patchGroup: (s, a) => commit(s, patchedGroup(s.mapping, a.groupId, a.patch)),
  patchSurface: (s, a) =>
    commit(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => ({ ...x, ...a.patch })),
    ),
  setGrid: (s, a) => (Number.isFinite(a.size) && a.size > 0 && a.size <= GRID_MAX ? commit(s, { ...s.mapping, grid: { size: a.size } }) : s),
  setMask: (s, a) =>
    commit(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => withMask(x, a.mask)),
    ),
  dragMask: (s, a) =>
    replaceLive(
      s,
      mapSurface(s.mapping, a.surfaceId, (x) => withMask(x, a.mask)),
    ),
  enterShapeEdit: (s, a) => enteredShapeEdit(s, a.surfaceId),
  exitShapeEdit: (s) => (s.shapeEdit === null ? s : { ...s, shapeEdit: null }),
  selectVertex: (s, a) => withVertex(s, a.index),
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

const handle = (s: EditorState, a: Action): EditorState => (handlers[a.type] as (s: EditorState, a: Action) => EditorState)(s, a);

export const reducer = (s: EditorState, a: Action): EditorState => (s.dragging && DRAG_BLOCKED.has(a.type) ? s : pruneShapeEdit(handle(s, a)));
