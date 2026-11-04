import { describe, expect, it } from 'vitest';
import { surf } from '../geometry/fixtures';
import type { EllipseMask, PolygonMask } from '../model/mapping';
import { initialMask, insertVertex, maskKind, moveMask, moveVertex, removeVertex, resizeEllipse } from './mask-edit';

const tri: PolygonMask = {
  type: 'polygon',
  points: [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
};
const ell: EllipseMask = { type: 'ellipse', x: 0.2, y: 0.2, width: 0.5, height: 0.4 };

describe('initialMask / maskKind', () => {
  it('builds the unit-space defaults', () => {
    expect(initialMask('ellipse')).toEqual({ type: 'ellipse', x: 0, y: 0, width: 1, height: 1 });
    expect(initialMask('polygon')).toEqual({
      type: 'polygon',
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    });
  });
  it('reports none for a surface without mask', () => {
    expect(maskKind(surf('a', 0, 0))).toBe('none');
    expect(maskKind({ ...surf('a', 0, 0), mask: ell })).toBe('ellipse');
    expect(maskKind({ ...surf('a', 0, 0), mask: tri })).toBe('polygon');
  });
});

describe('moveMask', () => {
  it('translates an ellipse and every polygon point', () => {
    expect(moveMask(ell, 0.1, -0.1)).toEqual({ ...ell, x: 0.30000000000000004, y: 0.1 });
    expect(moveMask(tri, 1, 1)).toEqual({
      type: 'polygon',
      points: [
        [1, 1],
        [2, 1],
        [1, 2],
      ],
    });
  });
});

describe('vertex edits', () => {
  it('moveVertex replaces one point', () => {
    expect(moveVertex(tri, 1, [5, 5]).points).toEqual([
      [0, 0],
      [5, 5],
      [0, 1],
    ]);
  });
  it('insertVertex adds a point between edge and edge+1, wrapping on the last edge', () => {
    expect(insertVertex(tri, 0, [0.5, 0]).points[1]).toEqual([0.5, 0]);
    expect(insertVertex(tri, 2, [0, 0.5]).points).toHaveLength(4);
    expect(insertVertex(tri, 2, [0, 0.5]).points[3]).toEqual([0, 0.5]);
  });
  it('insertVertex returns the same reference at 64 points', () => {
    const full: PolygonMask = { type: 'polygon', points: Array.from({ length: 64 }, (_, i): [number, number] => [i, 0]) };
    expect(insertVertex(full, 0, [0, 0])).toBe(full);
  });
  it('removeVertex drops a point but keeps the reference at 3 points', () => {
    const quad = insertVertex(tri, 0, [0.5, 0]);
    expect(removeVertex(quad, 1).points).toEqual(tri.points);
    expect(removeVertex(tri, 0)).toBe(tri);
  });
});

describe('resizeEllipse', () => {
  it('moves the dragged edge and fixes the opposite one', () => {
    expect(resizeEllipse(ell, 'right', [1, 0])).toEqual({ ...ell, width: 0.8 });
    expect(resizeEllipse(ell, 'bottom', [0, 1])).toEqual({ ...ell, height: 0.8 });
    const left = resizeEllipse(ell, 'left', [0, 0]);
    expect(left.x).toBe(0);
    expect(left.x + left.width).toBeCloseTo(0.7);
    const top = resizeEllipse(ell, 'top', [0, 0]);
    expect(top.y + top.height).toBeCloseTo(0.6);
  });
  it('keeps at least 1e-3 when dragged past the opposite edge', () => {
    const left = resizeEllipse(ell, 'left', [5, 0]);
    expect(left.width).toBeCloseTo(1e-3);
    expect(left.x + left.width).toBeCloseTo(0.7);
    expect(resizeEllipse(ell, 'right', [-5, 0]).width).toBe(1e-3);
    expect(resizeEllipse(ell, 'top', [0, 9]).height).toBeCloseTo(1e-3);
    expect(resizeEllipse(ell, 'bottom', [0, -9]).height).toBe(1e-3);
  });
});
