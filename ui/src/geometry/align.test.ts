import { describe, expect, it } from 'vitest';
import { alignReference, alignSurfaces, distributeSurfaces, translateSurface } from './align';
import { boundsOf } from './rect';
import { surf } from './fixtures';

describe('align', () => {
  it('translateSurface moves every corner', () => {
    expect(translateSurface(surf('a', 0, 0), 5, 7).corners[2]).toEqual([15, 17]);
  });
  it('align left snaps selected left edges to the min x, shape unchanged', () => {
    const ss = [surf('a', 20, 0), surf('b', 5, 30, 20, 10), surf('c', 90, 0)];
    const out = alignSurfaces(ss, ['a', 'b'], 'left');
    expect(out.map((s) => boundsOf(s).x)).toEqual([5, 5, 90]);
    expect(boundsOf(out[1] as (typeof out)[number])).toMatchObject({ width: 20, height: 10 });
    expect(out[2]).toBe(ss[2]);
  });
  it('align right/top/bottom/center', () => {
    const ss = [surf('a', 0, 0, 10, 10), surf('b', 40, 20, 20, 20)];
    const ids = ['a', 'b'];
    expect(alignSurfaces(ss, ids, 'right').map((s) => boundsOf(s).x)).toEqual([50, 40]);
    expect(alignSurfaces(ss, ids, 'top').map((s) => boundsOf(s).y)).toEqual([0, 0]);
    expect(alignSurfaces(ss, ids, 'bottom').map((s) => boundsOf(s).y)).toEqual([30, 20]);
    expect(alignSurfaces(ss, ids, 'centerX').map((s) => boundsOf(s).x)).toEqual([25, 20]);
    expect(alignSurfaces(ss, ids, 'centerY').map((s) => boundsOf(s).y)).toEqual([15, 10]);
  });
  it('ignores unknown ids', () => {
    const ss = [surf('a', 3, 0)];
    expect(alignSurfaces(ss, ['zzz'], 'left')).toEqual(ss);
  });
  it('distribute x spaces three surfaces evenly', () => {
    const ss = [surf('a', 0, 0), surf('b', 30, 0), surf('c', 100, 0)];
    const out = distributeSurfaces(ss, ['a', 'b', 'c'], 'x');
    expect(out.map((s) => boundsOf(s).x)).toEqual([0, 50, 100]);
  });
  it('distribute y works and preserves order of the array', () => {
    const ss = [surf('c', 0, 100), surf('a', 0, 0), surf('b', 0, 10)];
    const out = distributeSurfaces(ss, ['a', 'b', 'c'], 'y');
    expect(out.map((s) => s.id)).toEqual(['c', 'a', 'b']);
    expect(out.map((s) => boundsOf(s).y)).toEqual([100, 0, 50]);
  });
  it('two or fewer surfaces are unchanged', () => {
    const ss = [surf('a', 0, 0), surf('b', 30, 0)];
    expect(distributeSurfaces(ss, ['a', 'b'], 'x')).toEqual(ss);
  });
});

describe('align to canvas', () => {
  const canvas = { width: 200, height: 100 };
  const one = [surf('a', 30, 20, 40, 10), surf('b', 5, 5)];
  const bx = (mode: Parameters<typeof alignSurfaces>[2]) => {
    const out = alignSurfaces(one, ['a'], mode, alignReference(one, ['a'], canvas));
    return { out, b: boundsOf(out[0] as (typeof out)[number]) };
  };
  it('picks the canvas rect only for exactly one selected surface', () => {
    expect(alignReference(one, ['a'], canvas)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(alignReference(one, ['a', 'b'], canvas)).toBeUndefined();
    expect(alignReference(one, [], canvas)).toBeUndefined();
  });
  it('left/right/top/bottom touch the canvas edges', () => {
    expect(bx('left').b.x).toBe(0);
    expect(bx('right').b.x + 40).toBe(200);
    expect(bx('top').b.y).toBe(0);
    expect(bx('bottom').b.y + 10).toBe(100);
  });
  it('centerX/centerY centre on the canvas and leave others untouched', () => {
    expect(bx('centerX').b.x).toBe(80);
    expect(bx('centerY').b.y).toBe(45);
    expect(bx('centerX').out[1]).toBe(one[1]);
  });
  it('translates a non-rectangular quad without changing its shape', () => {
    const quad = {
      ...surf('q', 0, 0),
      corners: [
        [10, 10],
        [50, 20],
        [40, 60],
        [0, 40],
      ],
    } as ReturnType<typeof surf>;
    const out = alignSurfaces([quad], ['q'], 'right', alignReference([quad], ['q'], canvas));
    expect(out[0]?.corners).toEqual([
      [160, 10],
      [200, 20],
      [190, 60],
      [150, 40],
    ]);
  });
  it('multi-select still aligns to the selection bounds', () => {
    const ss = [surf('a', 20, 0), surf('b', 5, 30)];
    expect(alignSurfaces(ss, ['a', 'b'], 'left', alignReference(ss, ['a', 'b'], canvas)).map((s) => boundsOf(s).x)).toEqual([5, 5]);
  });
});
