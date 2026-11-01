import { useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Mapping, Point, Surface } from '../model/mapping';
import { roundedCorner, roundedOffset, type SnapOptions } from './drag';
import type { Action } from './reducer';
import { emptySelection, type CornerIndex, type EditorState } from './state';

/** Snap radius in stage (screen) px; converted to canvas px with the current scale. */
const SNAP_STAGE_PX = 8;

type Drag = { kind: 'corner'; surfaceId: string; index: CornerIndex } | { kind: 'surface'; ids: readonly string[]; primary: Surface; start: Point; applied: Point };

type Pointer = ReactPointerEvent<SVGElement>;

export type StageDrag = {
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

const geometry = (mapping: Mapping, scale: number, svgRef: RefObject<SVGSVGElement | null>): Geometry => ({
  toCanvas: (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0) return [0, 0];
    return [((e.clientX - rect.left) / rect.width) * mapping.canvas.width, ((e.clientY - rect.top) / rect.height) * mapping.canvas.height];
  },
  snapOptions: (e, moving) => ({
    grid: mapping.grid.size,
    others: mapping.surfaces.filter((s) => !moving.includes(s.id)),
    threshold: SNAP_STAGE_PX / scale,
    enabled: !e.altKey,
  }),
});

/** Applies one pointer move and returns the updated drag state. */
const applyMove = (geo: Geometry, dispatch: Dispatch<Action>, e: Pointer, d: Drag): Drag => {
  const p = geo.toCanvas(e);
  if (d.kind === 'corner') {
    dispatch({ type: 'dragCorner', surfaceId: d.surfaceId, index: d.index, to: roundedCorner(p, geo.snapOptions(e, [d.surfaceId])) });
    return d;
  }
  const total = roundedOffset(d.primary.corners, [p[0] - d.start[0], p[1] - d.start[1]], geo.snapOptions(e, d.ids));
  const dx = total[0] - d.applied[0];
  const dy = total[1] - d.applied[1];
  if (dx === 0 && dy === 0) return d;
  d.ids.forEach((surfaceId) => dispatch({ type: 'dragSurface', surfaceId, dx, dy }));
  return { ...d, applied: total };
};

/** Pointer interaction for the stage: corner drags and surface drags, with snapping (Option/Alt disables it). */
export const useStageDrag = ({ state, dispatch, svgRef, scale }: Args): StageDrag => {
  const drag = useRef<Drag | null>(null);
  const { mapping, selection } = state;

  const geo = geometry(mapping, scale, svgRef);
  const toCanvas = geo.toCanvas;

  const begin = (e: Pointer, next: Drag): void => {
    svgRef.current?.setPointerCapture(e.pointerId);
    dispatch({ type: 'dragStart' });
    drag.current = next;
  };

  return {
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
      if (d !== null) drag.current = applyMove(geo, dispatch, e, d);
    },
    onUp: (e) => {
      if (drag.current === null) return;
      drag.current = null;
      if (svgRef.current?.hasPointerCapture(e.pointerId) === true) svgRef.current.releasePointerCapture(e.pointerId);
      dispatch({ type: 'dragEnd' });
    },
  };
};
