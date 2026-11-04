import type { EllipseMask, Mask, Point, PolygonMask, Surface } from '../model/mapping';
import { insertVertex, moveMask, moveVertex, resizeEllipse, type EllipseHandle } from './mask-edit';

export type MaskHandle = EllipseHandle | { vertex: number } | 'body';

export type MaskDrag = { kind: 'mask'; surfaceId: string; corners: Surface['corners']; handle: MaskHandle; start: Point; origin: Mask };

export const ellipseHandlePoint = (m: EllipseMask, handle: EllipseHandle): Point => {
  switch (handle) {
    case 'left':
      return [m.x, m.y + m.height / 2];
    case 'right':
      return [m.x + m.width, m.y + m.height / 2];
    case 'top':
      return [m.x + m.width / 2, m.y];
    case 'bottom':
      return [m.x + m.width / 2, m.y + m.height];
  }
};

const shifted = (p: Point, d: Point): Point => [p[0] + d[0], p[1] + d[1]];

const resized = (origin: Mask, handle: EllipseHandle, d: Point): Mask => (origin.type === 'ellipse' ? resizeEllipse(origin, handle, shifted(ellipseHandlePoint(origin, handle), d)) : origin);

const vertexMoved = (origin: Mask, i: number, d: Point): Mask => {
  const p = origin.type === 'polygon' ? origin.points[i] : undefined;
  return origin.type === 'polygon' && p !== undefined ? moveVertex(origin, i, shifted(p, d)) : origin;
};

/** The mask after moving the pressed handle by the unit-space delta since the press; always derived from the origin. */
export const draggedMask = (d: Pick<MaskDrag, 'handle' | 'start' | 'origin'>, at: Point): Mask => {
  const delta: Point = [at[0] - d.start[0], at[1] - d.start[1]];
  if (d.handle === 'body') return moveMask(d.origin, delta[0], delta[1]);
  if (typeof d.handle === 'object') return vertexMoved(d.origin, d.handle.vertex, delta);
  return resized(d.origin, d.handle, delta);
};

/** The polygon with a vertex inserted after `edge`, or null when it is already at the vertex limit. */
export const edgeInserted = (m: PolygonMask, edge: number, at: Point): PolygonMask | null => {
  const next = insertVertex(m, edge, at);
  return next === m ? null : next;
};
