import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import { boundsOf } from '../geometry/rect';
import type { LayerNode, Mapping } from '../model/mapping';
import { followCorner } from './follow-corner';
import { layoutTree } from './layout-tree';

const row = { direction: 'row', gap: 20, align: 'start', padding: 0 } as const;

const laid = (m: Mapping): Mapping => layoutTree(m);

const flat = (): Mapping =>
  laid({
    ...mapOf(surf('a', 0, 0, 100, 50), surf('b', 500, 500, 100, 80)),
    groups: [groupOf('g', { origin: [100, 100], layout: row })],
    layers: [gn('g', sn('a'), sn('b'))],
  });

const get = (m: Mapping, id: string) => m.surfaces.find((s) => s.id === id)!;
const origin = (m: Mapping, id: string) => m.groups.find((g) => g.id === id)!.origin;

describe('followCorner', () => {
  it('moves the origin so a leading corner follows the cursor', () => {
    const out = followCorner(flat(), 'a', 0, [90, 95]);
    expect(get(out, 'a').corners[0]).toEqual([90, 95]);
    expect(origin(out, 'g')).toEqual([90, 95]);
    expect(boundsOf(get(out, 'b'))).toMatchObject({ x: 220, y: 95 });
  });

  it('moves the origin when the group is not first among top-level layers', () => {
    const m = laid({
      ...mapOf(surf('x', 0, 0), surf('a', 0, 0, 100, 50), surf('b', 500, 500, 100, 80)),
      groups: [groupOf('g', { origin: [100, 100], layout: row })],
      layers: [sn('x'), gn('g', sn('a'), sn('b'))],
    });
    const out = followCorner(m, 'a', 0, [90, 95]);
    expect(origin(out, 'g')).toEqual([90, 95]);
    expect(boundsOf(get(out, 'b'))).toMatchObject({ x: 220, y: 95 });
  });

  it('keeps a non-leading item pinned and does not move the origin', () => {
    const out = followCorner(flat(), 'b', 0, [200, 90]);
    expect(origin(out, 'g')).toEqual([100, 100]);
    expect(boundsOf(get(out, 'b'))).toMatchObject({ x: 220, y: 100 });
    expect(get(out, 'b').corners[0]).not.toEqual([200, 90]);
  });

  it('pushes followers back when a trailing corner grows', () => {
    const out = followCorner(flat(), 'a', 2, [230, 160]);
    expect(origin(out, 'g')).toEqual([100, 100]);
    expect(boundsOf(get(out, 'b')).x).toBe(250);
  });

  it('ignores inward movement of a leading corner', () => {
    const out = followCorner(flat(), 'a', 0, [110, 105]);
    expect(origin(out, 'g')).toEqual([100, 100]);
  });

  it('moves the top-level origin when leading at both levels', () => {
    const m = laid({
      ...mapOf(surf('a', 0, 0, 100, 50), surf('b', 0, 0, 10, 10)),
      groups: [groupOf('g', { origin: [100, 100], layout: row }), groupOf('h', { layout: row })],
      layers: [gn('g', gn('h', sn('a')), sn('b'))],
    });
    const out = followCorner(m, 'a', 0, [90, 95]);
    expect(origin(out, 'g')).toEqual([90, 95]);
    expect(get(out, 'a').corners[0]).toEqual([90, 95]);
  });

  it('does not move the origin when a level is not leading', () => {
    const layers: LayerNode[] = [gn('g', sn('b'), gn('h', sn('a')))];
    const m = laid({
      ...mapOf(surf('a', 0, 0, 100, 50), surf('b', 0, 0, 10, 10)),
      groups: [groupOf('g', { origin: [100, 100], layout: row }), groupOf('h', { layout: row })],
      layers,
    });
    expect(origin(followCorner(m, 'a', 0, [0, 0]), 'g')).toEqual([100, 100]);
  });
});
