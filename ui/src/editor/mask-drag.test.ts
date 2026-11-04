import { describe, expect, it } from 'vitest';
import type { EllipseMask, Point, PolygonMask } from '../model/mapping';
import { draggedMask, edgeInserted, ellipseHandlePoint } from './mask-drag';

const ellipse: EllipseMask = { type: 'ellipse', x: 0.2, y: 0.4, width: 0.6, height: 0.2 };
const triangle: PolygonMask = {
  type: 'polygon',
  points: [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
};

describe('ellipseHandlePoint', () => {
  it('puts each handle at the middle of its bounding-box edge', () => {
    expect(ellipseHandlePoint(ellipse, 'left')).toEqual([0.2, 0.5]);
    expect(ellipseHandlePoint(ellipse, 'right')).toEqual([0.8, 0.5]);
    expect(ellipseHandlePoint(ellipse, 'top')).toEqual([0.5, 0.4]);
    expect(ellipseHandlePoint(ellipse, 'bottom')).toEqual([0.5, expect.closeTo(0.6)]);
  });
});

describe('draggedMask', () => {
  it('moves a vertex by the delta, not to the pointer', () => {
    const m = draggedMask({ handle: { vertex: 1 }, start: [0.9, 0.1], origin: triangle }, [1, 0.2]);
    expect(m.type === 'polygon' ? m.points[1] : null).toEqual([expect.closeTo(1.1), expect.closeTo(0.1)]);
  });
  it('resizes from the handle point shifted by the delta', () => {
    const m = draggedMask({ handle: 'left', start: [0.25, 0.5], origin: ellipse }, [0.15, 0.5]);
    expect(m.type === 'ellipse' ? [m.x, m.width] : null).toEqual([expect.closeTo(0.1), expect.closeTo(0.7)]);
  });
  it('ignores a handle that does not fit the mask type', () => {
    expect(draggedMask({ handle: 'left', start: [0, 0], origin: triangle }, [1, 1])).toBe(triangle);
    expect(draggedMask({ handle: { vertex: 0 }, start: [0, 0], origin: ellipse }, [1, 1])).toBe(ellipse);
  });
});

describe('edgeInserted', () => {
  it('returns null at the vertex limit', () => {
    const full: PolygonMask = { type: 'polygon', points: Array.from({ length: 64 }, (_, i): Point => [i, 0]) };
    expect(edgeInserted(full, 0, [0.5, 0])).toBeNull();
    expect(edgeInserted(triangle, 0, [0.5, 0])?.points).toHaveLength(4);
  });
});
