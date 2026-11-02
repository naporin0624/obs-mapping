import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import { boundsOf } from '../geometry/rect';
import { dfsSurfaceIds } from '../model/layers';
import type { GroupLayout, LayerNode, Mapping, Surface } from '../model/mapping';
import { groupFrame } from './frame';
import { layoutTree } from './layout-tree';

const layoutOf = (patch: Partial<GroupLayout>): GroupLayout => ({ direction: 'row', gap: 20, align: 'start', padding: 0, ...patch });

const base = (patch: Partial<GroupLayout> = {}, surfaces: Surface[] = [surf('a', 0, 0, 100, 50), surf('b', 500, 500, 100, 80)]): Mapping => ({
  ...mapOf(...surfaces),
  groups: [groupOf('g', { origin: [100, 100], layout: layoutOf(patch) })],
  layers: [gn('g', ...surfaces.map((s) => sn(s.id)))],
});

const get = (m: Mapping, id: string): Surface => m.surfaces.find((s) => s.id === id)!;

describe('layoutTree', () => {
  it('row/start packs children from the origin with gap', () => {
    const out = layoutTree(base());
    expect(boundsOf(get(out, 'a'))).toEqual({ x: 100, y: 100, width: 100, height: 50 });
    expect(boundsOf(get(out, 'b'))).toEqual({ x: 220, y: 100, width: 100, height: 80 });
  });

  it('aligns on the cross axis', () => {
    expect(boundsOf(get(layoutTree(base({ align: 'center' })), 'a')).y).toBe(115);
    expect(boundsOf(get(layoutTree(base({ align: 'end' })), 'a')).y).toBe(130);
  });

  it('column stacks vertically', () => {
    expect(boundsOf(get(layoutTree(base({ direction: 'column' })), 'b')).y).toBe(170);
  });

  it('padding offsets the first child', () => {
    const b = boundsOf(get(layoutTree(base({ padding: 10 })), 'a'));
    expect([b.x, b.y]).toEqual([110, 110]);
  });

  it('overwrites nested origins and sizes nested groups', () => {
    const surfaces = [surf('a', 0, 0, 100, 50), surf('c', 0, 0, 20, 20), surf('d', 0, 0, 20, 20)];
    const m: Mapping = {
      ...mapOf(...surfaces),
      groups: [groupOf('g', { origin: [100, 100], layout: layoutOf({ gap: 10 }) }), groupOf('h', { origin: [0, 0], layout: layoutOf({ direction: 'column', gap: 5, padding: 4 }) })],
      layers: [gn('g', sn('a'), gn('h', sn('c'), sn('d')))],
    };
    const out = layoutTree(m);
    expect(out.groups.find((g) => g.id === 'h')!.origin).toEqual([210, 100]);
    expect(groupFrame(out, 'h')).toEqual({ x: 210, y: 100, width: 28, height: 53 });
    expect(boundsOf(get(out, 'c'))).toMatchObject({ x: 214, y: 104 });
  });

  it('keeps corner offsets of a skewed quad', () => {
    const skew: Surface = {
      ...surf('a', 0, 0),
      corners: [
        [0, 0],
        [100, 10],
        [90, 60],
        [5, 50],
      ],
    };
    const out = layoutTree(base({}, [skew]));
    expect(get(out, 'a').corners).toEqual([
      [100, 100],
      [200, 110],
      [190, 160],
      [105, 150],
    ]);
  });

  it('skips hidden surfaces and closes the gap', () => {
    const a: Surface = { ...surf('a', 3, 4, 100, 50), visible: false };
    const out = layoutTree(base({}, [a, surf('b', 500, 500, 100, 80)]));
    expect(get(out, 'a')).toEqual(a);
    expect(boundsOf(get(out, 'b')).x).toBe(100);
  });

  it('leaves hidden groups untouched with their subtree', () => {
    const m = base();
    const hidden: Mapping = { ...m, groups: [{ ...m.groups[0]!, visible: false }] };
    expect(layoutTree(hidden)).toEqual(hidden);
  });

  it('never moves top-level surfaces', () => {
    const m: Mapping = { ...mapOf(surf('x', 7, 8)) };
    expect(layoutTree(m).surfaces).toEqual(m.surfaces);
  });

  it('orders surfaces like the tree', () => {
    const surfaces = [surf('a', 0, 0), surf('b', 0, 0), surf('c', 0, 0)];
    const layers: LayerNode[] = [sn('c'), gn('g', sn('b'), sn('a'))];
    const m: Mapping = { ...mapOf(...surfaces), groups: [groupOf('g')], layers };
    expect(layoutTree(m).surfaces.map((s) => s.id)).toEqual(dfsSurfaceIds(layers));
  });

  it('is idempotent with fractional inputs', () => {
    const surfaces = [surf('a', 0.1, 0.7, 33.3, 17.1), surf('b', 0.7, 0.1, 21.7, 9.9), surf('c', 5.3, 2.2, 10.1, 11.3)];
    const m: Mapping = {
      ...mapOf(...surfaces),
      groups: [
        groupOf('g', { origin: [10.1, 20.7], layout: layoutOf({ align: 'center', gap: 3.3, padding: 1.7 }) }),
        groupOf('h', { layout: layoutOf({ direction: 'column', align: 'center', gap: 0.7 }) }),
      ],
      layers: [gn('g', sn('a'), gn('h', sn('b'), sn('c')))],
    };
    const once = layoutTree(m);
    expect(layoutTree(once)).toEqual(once);
  });

  it('leaves a nested hidden group untouched and packs the next sibling as if absent', () => {
    const surfaces = [surf('a', 0, 0, 100, 50), surf('h1', 300, 300, 10, 10), surf('b', 500, 500, 100, 80)];
    const m: Mapping = {
      ...mapOf(...surfaces),
      groups: [groupOf('g', { origin: [100, 100], layout: layoutOf({}) }), groupOf('h', { visible: false, origin: [7, 8] })],
      layers: [gn('g', sn('a'), gn('h', sn('h1')), sn('b'))],
    };
    const out = layoutTree(m);
    expect(get(out, 'h1')).toEqual(get(m, 'h1'));
    expect(out.groups.find((g) => g.id === 'h')).toEqual(m.groups[1]);
    expect(boundsOf(get(out, 'b')).x).toBe(220);
  });

  it('keeps a nested origin that differs from the computed one by less than the epsilon', () => {
    const surfaces = [surf('a', 0, 0, 100, 50), surf('c', 0, 0, 20, 20)];
    const nearby: readonly [number, number] = [220 + 1e-12, 100];
    const m: Mapping = {
      ...mapOf(...surfaces),
      groups: [groupOf('g', { origin: [100, 100], layout: layoutOf({}) }), groupOf('h', { origin: nearby })],
      layers: [gn('g', sn('a'), gn('h', sn('c')))],
    };
    expect(layoutTree(m).groups.find((g) => g.id === 'h')!.origin).toBe(nearby);
  });
});
