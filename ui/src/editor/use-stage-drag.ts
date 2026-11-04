import { useRef, useState, type Dispatch, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Mapping, Point, Surface } from '../model/mapping';
import { effectiveVisibleIds } from '../model/visibility';
import type { GuideLine } from '../geometry/snap';
import { roundedCornerHit, roundedGroupOffsetHit, roundedOffsetHit, snapTargets, type SnapOptions } from './drag';
import { subtreeIds } from '../model/layers';
import { unionBounds } from '../geometry/align';
import { pasteboardBounds } from '../geometry/pasteboard';
import type { Bounds } from '../geometry/rect';
import { isLaidOut, isTopLevel, movableItems } from './items';
import type { UiAction } from './reducer';
import { clickTarget, deepTarget, drillTarget, pickPath, surfaceAt } from './stage-pick';
import { quadToUnit } from '../geometry/homography';
import { polygonContains } from '../geometry/mask';
import { draggedMask, edgeInserted, type MaskDrag, type MaskHandle } from './mask-drag';
import { emptySelection, type CornerIndex, type EditorState, type Selection } from './state';

/** Snap radius in stage (screen) px; converted to canvas px with the current scale. */
const SNAP_STAGE_PX = 8;

type ItemsDrag = { kind: 'items'; ids: readonly string[]; ownIds: readonly string[]; frame: Bounds; start: Point; applied: Point };

type Drag = { kind: 'corner'; surfaceId: string; index: CornerIndex } | { kind: 'surface'; ids: readonly string[]; primary: Surface; start: Point; applied: Point } | ItemsDrag | MaskDrag;

type Pointer = ReactPointerEvent<SVGElement>;
type Click = ReactMouseEvent<SVGElement>;

export type StageDrag = {
  /** Extended edge lines the current drag is snapped to; empty when idle. Transient, never persisted. */
  guides: readonly GuideLine[];
  onBackgroundDown: (e: Pointer) => void;
  onCornerDown: (e: Pointer, surfaceId: string, index: CornerIndex) => void;
  onSurfaceDown: (e: Pointer, surfaceId: string) => void;
  onGroupDown: (e: Pointer, groupId: string) => void;
  onMaskHandleDown: (e: Pointer, surfaceId: string, handle: MaskHandle) => void;
  onMaskEdgeDown: (e: Pointer, surfaceId: string, edge: number) => void;
  onDoubleClick: (e: Click) => void;
  onMove: (e: Pointer) => void;
  onUp: (e: Pointer) => void;
};

type Args = { state: EditorState; dispatch: Dispatch<UiAction>; svgRef: RefObject<SVGSVGElement | null>; scale: number };

const nextIds = (current: readonly string[], id: string, additive: boolean): readonly string[] => {
  if (additive) return toggled(current, id);
  return current.includes(id) ? current : [id];
};

const NO_GUIDES: readonly GuideLine[] = [];

const replaces = (e: Pointer): boolean => e.metaKey && !e.shiftKey;

const pickedNode = (m: Mapping, sel: Selection, e: Pointer, surfaceId: string): string => {
  const path = pickPath(m, surfaceId);
  return replaces(e) ? deepTarget(path) : clickTarget(m, path, sel);
};

const selectionOf = (m: Mapping, ids: readonly string[]): Selection => ({
  surfaceIds: ids.filter((id) => !m.groups.some((g) => g.id === id)),
  groupIds: ids.filter((id) => m.groups.some((g) => g.id === id)),
  corner: null,
});

const toggled = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

type Geometry = { toCanvas: (e: Pick<Click, 'clientX' | 'clientY'>) => Point; snapOptions: (e: Pointer, moving: readonly string[]) => SnapOptions };

const startItems = (m: Mapping, sel: Selection, start: Point): Drag | null => {
  const items = movableItems(m, sel);
  if (items.length === 0) return null;
  const ids = items.map((i) => i.id);
  return { kind: 'items', ids, ownIds: ids.flatMap((id) => ownSurfaceIds(m, id)), frame: unionBounds(items.map((i) => i.bounds)), start, applied: [0, 0] };
};

const ownSurfaceIds = (m: Mapping, id: string): readonly string[] => (m.groups.some((g) => g.id === id) ? subtreeIds(m.layers, id).surfaceIds : [id]);

const geometry = (mapping: Mapping, scale: number, svgRef: RefObject<SVGSVGElement | null>): Geometry => {
  const visibleIds = effectiveVisibleIds(mapping);
  const board = pasteboardBounds(mapping.canvas);
  return {
    toCanvas: (e) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect === undefined || rect.width === 0) return [0, 0];
      return [board.x + ((e.clientX - rect.left) / rect.width) * board.width, board.y + ((e.clientY - rect.top) / rect.height) * board.height];
    },
    snapOptions: (e, moving) => ({
      grid: mapping.grid.size,
      others: snapTargets(mapping.surfaces, moving, visibleIds),
      threshold: SNAP_STAGE_PX / scale,
      enabled: !e.altKey,
    }),
  };
};

type Moved = { drag: Drag; guides: readonly GuideLine[] };

const moveItems = (geo: Geometry, dispatch: Dispatch<UiAction>, e: Pointer, d: ItemsDrag, p: Point): Moved => {
  const hit = roundedGroupOffsetHit(d.frame, [p[0] - d.start[0], p[1] - d.start[1]], geo.snapOptions(e, d.ownIds));
  const dx = hit.point[0] - d.applied[0];
  const dy = hit.point[1] - d.applied[1];
  if (dx === 0 && dy === 0) return { drag: d, guides: hit.guides };
  dispatch({ type: 'dragItems', ids: d.ids, dx, dy });
  return { drag: { ...d, applied: hit.point }, guides: hit.guides };
};

const moveMaskHandle = (dispatch: Dispatch<UiAction>, d: MaskDrag, p: Point): Moved => {
  const unit = quadToUnit(d.corners, p);
  if (unit !== null) dispatch({ type: 'dragMask', surfaceId: d.surfaceId, mask: draggedMask(d, unit) });
  return { drag: d, guides: NO_GUIDES };
};

/** Applies one pointer move and returns the updated drag state with the active snap guides. */
const applyMove = (geo: Geometry, dispatch: Dispatch<UiAction>, e: Pointer, d: Drag): Moved => {
  const p = geo.toCanvas(e);
  if (d.kind === 'items') return moveItems(geo, dispatch, e, d, p);
  if (d.kind === 'mask') return moveMaskHandle(dispatch, d, p);
  if (d.kind === 'corner') {
    const hit = roundedCornerHit(p, geo.snapOptions(e, [d.surfaceId]));
    dispatch({ type: 'dragCorner', surfaceId: d.surfaceId, index: d.index, to: hit.point });
    return { drag: d, guides: hit.guides };
  }
  const hit = roundedOffsetHit(d.primary.corners, [p[0] - d.start[0], p[1] - d.start[1]], geo.snapOptions(e, d.ids));
  const dx = hit.point[0] - d.applied[0];
  const dy = hit.point[1] - d.applied[1];
  if (dx === 0 && dy === 0) return { drag: d, guides: hit.guides };
  d.ids.forEach((surfaceId) => dispatch({ type: 'dragSurface', surfaceId, dx, dy }));
  return { drag: { ...d, applied: hit.point }, guides: hit.guides };
};

/** Keeps the previous array when both are empty so idle moves do not re-render. */
const nextGuides = (prev: readonly GuideLine[], next: readonly GuideLine[]): readonly GuideLine[] => (prev.length === 0 && next.length === 0 ? prev : next);

/** Group moves belong to the group drag; a laid-out surface is positioned by its group, so it never drags. */
const dragFor = (m: Mapping, sel: Selection, target: string, start: Point): Drag | null => {
  if (m.groups.some((g) => g.id === target)) return isTopLevel(m, target) ? startItems(m, sel, start) : null;
  const primary = m.surfaces.find((s) => s.id === target);
  if (primary === undefined || isLaidOut(m, target)) return null;
  if (sel.groupIds.some((id) => isTopLevel(m, id))) return startItems(m, sel, start);
  return { kind: 'surface', ids: sel.surfaceIds.filter((id) => !isLaidOut(m, id)), primary, start, applied: [0, 0] };
};

type Ctx = { mapping: Mapping; selection: Selection; dispatch: Dispatch<UiAction> };

/** Selects what the press picked and returns the drag it starts, if any. */
const pressSurface = ({ mapping, selection, dispatch }: Ctx, e: Pointer, surfaceId: string, start: Point): Drag | null => {
  const target = pickedNode(mapping, selection, e, surfaceId);
  const ids = replaces(e) ? [target] : nextIds([...selection.surfaceIds, ...selection.groupIds], target, e.shiftKey);
  const next = selectionOf(mapping, ids);
  dispatch({ type: 'select', selection: next });
  return ids.includes(target) ? dragFor(mapping, next, target, start) : null;
};

/** A modified press inside a frame acts on the surface under the pointer; a plain one drags the group. */
const pressGroup = (ctx: Ctx, e: Pointer, groupId: string, at: Point): Drag | null => {
  const under = e.metaKey || e.shiftKey ? surfaceAt(ctx.mapping, at) : null;
  if (under !== null) return pressSurface(ctx, e, under, at);
  if (!isTopLevel(ctx.mapping, groupId)) return null;
  const sel = ctx.selection.groupIds.includes(groupId) ? ctx.selection : { ...emptySelection(), groupIds: [groupId] };
  return startItems(ctx.mapping, sel, at);
};

const isSoleSurface = (sel: Selection, id: string): boolean => sel.groupIds.length === 0 && sel.surfaceIds.length === 1 && sel.surfaceIds[0] === id;

/** Drills one level deeper; once the selected surface is the deepest level, enters its shape edit. */
const drill = ({ mapping, selection, dispatch }: Ctx, at: Point): void => {
  const surfaceId = surfaceAt(mapping, at);
  if (surfaceId === null) return;
  const target = drillTarget(pickPath(mapping, surfaceId), selection);
  if (isSoleSurface(selection, target)) dispatch({ type: 'enterShapeEdit', surfaceId: target });
  else dispatch({ type: 'select', selection: selectionOf(mapping, [target]) });
};

const editedSurface = (s: EditorState): Surface | null => {
  const id = s.shapeEdit?.surfaceId;
  return s.mapping.surfaces.find((x) => x.id === id) ?? null;
};

/** Mask drags start from the unit-space press point and the mask as it was at the press. */
const startMaskDrag = (s: EditorState, surfaceId: string, handle: MaskHandle, p: Point): MaskDrag | null => {
  const surface = s.mapping.surfaces.find((x) => x.id === surfaceId);
  const start = surface === undefined ? null : quadToUnit(surface.corners, p);
  if (surface?.mask === undefined || start === null) return null;
  return { kind: 'mask', surfaceId, corners: surface.corners, handle, start, origin: surface.mask };
};

const insertAtEdge = (s: EditorState, dispatch: Dispatch<UiAction>, surfaceId: string, edge: number, p: Point): void => {
  const surface = s.mapping.surfaces.find((x) => x.id === surfaceId);
  const at = surface === undefined ? null : quadToUnit(surface.corners, p);
  const next = surface?.mask?.type === 'polygon' && at !== null ? edgeInserted(surface.mask, edge, at) : null;
  if (next === null) return;
  dispatch({ type: 'setMask', surfaceId, mask: next });
  dispatch({ type: 'selectVertex', index: edge + 1 });
};

// Presses inside the edited quad are swallowed so shape edit stays on.
const insideEditedQuad = (s: EditorState, p: Point): boolean => {
  const edited = editedSurface(s);
  return edited !== null && polygonContains(edited.corners, p);
};

// While shape-editing, the background only leaves the edit; the surface stays selected.
const backgroundPress = (s: EditorState, dispatch: Dispatch<UiAction>, p: Point): void => {
  if (s.shapeEdit === null) dispatch({ type: 'select', selection: emptySelection() });
  else if (!insideEditedQuad(s, p)) dispatch({ type: 'exitShapeEdit' });
};

type Begin = (e: Pointer, d: Drag) => void;

const nodePresses = (s: EditorState, dispatch: Dispatch<UiAction>, toCanvas: Geometry['toCanvas'], begin: Begin): Pick<StageDrag, 'onSurfaceDown' | 'onGroupDown'> => {
  const ctx: Ctx = { mapping: s.mapping, selection: s.selection, dispatch };
  return {
    onSurfaceDown: (e, surfaceId) => {
      e.stopPropagation();
      const at = toCanvas(e);
      if (insideEditedQuad(s, at)) return;
      if (s.shapeEdit !== null) dispatch({ type: 'exitShapeEdit' });
      const started = pressSurface(ctx, e, surfaceId, at);
      if (started !== null) begin(e, started);
    },
    onGroupDown: (e, groupId) => {
      e.stopPropagation();
      const at = toCanvas(e);
      if (insideEditedQuad(s, at)) return;
      if (s.shapeEdit !== null) dispatch({ type: 'exitShapeEdit' });
      const started = pressGroup(ctx, e, groupId, at);
      if (started !== null) begin(e, started);
    },
  };
};

const maskPresses = (s: EditorState, dispatch: Dispatch<UiAction>, toCanvas: Geometry['toCanvas'], begin: Begin): Pick<StageDrag, 'onMaskHandleDown' | 'onMaskEdgeDown'> => ({
  onMaskHandleDown: (e, surfaceId, handle) => {
    e.stopPropagation();
    const started = startMaskDrag(s, surfaceId, handle, toCanvas(e));
    if (started === null) return;
    if (typeof handle === 'object') dispatch({ type: 'selectVertex', index: handle.vertex });
    begin(e, started);
  },
  onMaskEdgeDown: (e, surfaceId, edge) => {
    e.stopPropagation();
    insertAtEdge(s, dispatch, surfaceId, edge, toCanvas(e));
  },
});

/** Pointer interaction for the stage: picking, drilling, shape edit, and corner, surface, group and mask drags, with snapping (Option/Alt disables it). */
export const useStageDrag = ({ state, dispatch, svgRef, scale }: Args): StageDrag => {
  const drag = useRef<Drag | null>(null);
  const [guides, setGuides] = useState<readonly GuideLine[]>(NO_GUIDES);
  const { mapping, selection } = state;

  const geo = geometry(mapping, scale, svgRef);
  const toCanvas = geo.toCanvas;

  const begin = (e: Pointer, next: Drag): void => {
    svgRef.current?.setPointerCapture(e.pointerId);
    dispatch({ type: 'dragStart' });
    drag.current = next;
  };

  return {
    guides,
    onBackgroundDown: (e) => backgroundPress(state, dispatch, toCanvas(e)),
    onCornerDown: (e, surfaceId, index) => {
      e.stopPropagation();
      dispatch({ type: 'select', selection: { surfaceIds: [surfaceId], groupIds: [], corner: { surfaceId, index } } });
      begin(e, { kind: 'corner', surfaceId, index });
    },
    ...nodePresses(state, dispatch, toCanvas, begin),
    ...maskPresses(state, dispatch, toCanvas, begin),
    onDoubleClick: (e) => {
      if (state.shapeEdit === null) drill({ mapping, selection, dispatch }, toCanvas(e));
    },
    onMove: (e) => {
      const d = drag.current;
      if (d === null) return;
      const moved = applyMove(geo, dispatch, e, d);
      drag.current = moved.drag;
      setGuides((prev) => nextGuides(prev, moved.guides));
    },
    onUp: (e) => {
      if (drag.current === null) return;
      drag.current = null;
      setGuides(NO_GUIDES);
      if (svgRef.current?.hasPointerCapture(e.pointerId) === true) svgRef.current.releasePointerCapture(e.pointerId);
      dispatch({ type: 'dragEnd' });
    },
  };
};
