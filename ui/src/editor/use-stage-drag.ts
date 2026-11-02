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
import { emptySelection, type CornerIndex, type EditorState, type Selection } from './state';

/** Snap radius in stage (screen) px; converted to canvas px with the current scale. */
const SNAP_STAGE_PX = 8;

type ItemsDrag = { kind: 'items'; ids: readonly string[]; ownIds: readonly string[]; frame: Bounds; start: Point; applied: Point };

type Drag = { kind: 'corner'; surfaceId: string; index: CornerIndex } | { kind: 'surface'; ids: readonly string[]; primary: Surface; start: Point; applied: Point } | ItemsDrag;

type Pointer = ReactPointerEvent<SVGElement>;
type Click = ReactMouseEvent<SVGElement>;

export type StageDrag = {
  /** Extended edge lines the current drag is snapped to; empty when idle. Transient, never persisted. */
  guides: readonly GuideLine[];
  onBackgroundDown: () => void;
  onCornerDown: (e: Pointer, surfaceId: string, index: CornerIndex) => void;
  onSurfaceDown: (e: Pointer, surfaceId: string) => void;
  onGroupDown: (e: Pointer, groupId: string) => void;
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

/** Applies one pointer move and returns the updated drag state with the active snap guides. */
const applyMove = (geo: Geometry, dispatch: Dispatch<UiAction>, e: Pointer, d: Drag): Moved => {
  const p = geo.toCanvas(e);
  if (d.kind === 'items') return moveItems(geo, dispatch, e, d, p);
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

const drill = ({ mapping, selection, dispatch }: Ctx, at: Point): void => {
  const surfaceId = surfaceAt(mapping, at);
  if (surfaceId === null) return;
  const target = drillTarget(pickPath(mapping, surfaceId), selection);
  dispatch({ type: 'select', selection: selectionOf(mapping, [target]) });
};

/** Pointer interaction for the stage: picking, drilling, and corner, surface, and group drags, with snapping (Option/Alt disables it). */
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
    onBackgroundDown: () => dispatch({ type: 'select', selection: emptySelection() }),
    onCornerDown: (e, surfaceId, index) => {
      e.stopPropagation();
      dispatch({ type: 'select', selection: { surfaceIds: [surfaceId], groupIds: [], corner: { surfaceId, index } } });
      begin(e, { kind: 'corner', surfaceId, index });
    },
    onSurfaceDown: (e, surfaceId) => {
      e.stopPropagation();
      const started = pressSurface({ mapping, selection, dispatch }, e, surfaceId, toCanvas(e));
      if (started !== null) begin(e, started);
    },
    onGroupDown: (e, groupId) => {
      e.stopPropagation();
      const started = pressGroup({ mapping, selection, dispatch }, e, groupId, toCanvas(e));
      if (started !== null) begin(e, started);
    },
    onDoubleClick: (e) => drill({ mapping, selection, dispatch }, toCanvas(e)),
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
