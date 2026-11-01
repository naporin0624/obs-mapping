import { useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Mapping, Point, Surface } from '../model/mapping';
import { effectiveVisibleIds } from '../model/visibility';
import type { GuideLine } from '../geometry/snap';
import { roundedCornerHit, roundedOffsetHit, snapTargets, type SnapOptions } from './drag';
import type { Action } from './reducer';
import { emptySelection, type CornerIndex, type EditorState } from './state';

/** Snap radius in stage (screen) px; converted to canvas px with the current scale. */
const SNAP_STAGE_PX = 8;

type Drag = { kind: 'corner'; surfaceId: string; index: CornerIndex } | { kind: 'surface'; ids: readonly string[]; primary: Surface; start: Point; applied: Point };

type Pointer = ReactPointerEvent<SVGElement>;

export type StageDrag = {
  /** Extended edge lines the current drag is snapped to; empty when idle. Transient, never persisted. */
  guides: readonly GuideLine[];
  onBackgroundDown: () => void;
  onCornerDown: (e: Pointer, surfaceId: string, index: CornerIndex) => void;
  onSurfaceDown: (e: Pointer, surfaceId: string) => void;
  onMove: (e: Pointer) => void;
  onUp: (e: Pointer) => void;
};

type Args = { state: EditorState; dispatch: Dispatch<Action>; svgRef: RefObject<SVGSVGElement | null>; scale: number };

const nextIds = (current: readonly string[], id: string, additive: boolean): readonly string[] => {
  if (additive) return toggled(current, id);
  return current.includes(id) ? current : [id];
};

const toggled = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

type Geometry = { toCanvas: (e: Pointer) => Point; snapOptions: (e: Pointer, moving: readonly string[]) => SnapOptions };

const geometry = (mapping: Mapping, scale: number, svgRef: RefObject<SVGSVGElement | null>): Geometry => {
  const visibleIds = effectiveVisibleIds(mapping);
  return {
    toCanvas: (e) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect === undefined || rect.width === 0) return [0, 0];
      return [((e.clientX - rect.left) / rect.width) * mapping.canvas.width, ((e.clientY - rect.top) / rect.height) * mapping.canvas.height];
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

/** Applies one pointer move and returns the updated drag state with the active snap guides. */
const applyMove = (geo: Geometry, dispatch: Dispatch<Action>, e: Pointer, d: Drag): Moved => {
  const p = geo.toCanvas(e);
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

const NO_GUIDES: readonly GuideLine[] = [];

/** Keeps the previous array when both are empty so idle moves do not re-render. */
const nextGuides = (prev: readonly GuideLine[], next: readonly GuideLine[]): readonly GuideLine[] => (prev.length === 0 && next.length === 0 ? prev : next);

/** Pointer interaction for the stage: corner drags and surface drags, with snapping (Option/Alt disables it). */
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
      dispatch({ type: 'select', selection: { surfaceIds: [surfaceId], corner: { surfaceId, index } } });
      begin(e, { kind: 'corner', surfaceId, index });
    },
    onSurfaceDown: (e, surfaceId) => {
      e.stopPropagation();
      const ids = nextIds(selection.surfaceIds, surfaceId, e.shiftKey || e.metaKey);
      dispatch({ type: 'select', selection: { surfaceIds: [...ids], corner: null } });
      const primary = mapping.surfaces.find((s) => s.id === surfaceId);
      if (primary === undefined || !ids.includes(surfaceId)) return;
      begin(e, { kind: 'surface', ids, primary, start: toCanvas(e), applied: [0, 0] });
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
