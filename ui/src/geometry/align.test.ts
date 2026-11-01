import { describe, expect, it } from 'vitest';
import { alignSurfaces, distributeSurfaces, translateSurface } from './align';
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
