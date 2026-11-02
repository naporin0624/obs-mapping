import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { LayerNode, Mapping } from '../model/mapping';
import { groupItems, groupProblem, ungroupItems } from './grouping';
import { MAX_TREE_DEPTH } from '../model/validate-tree';
import { emptySelection } from './state';

const three = () => mapOf(surf('a', 0, 0), surf('b', 20, 0), surf('c', 40, 0));
const select = (surfaceIds: string[], groupIds: string[] = []) => ({ ...emptySelection(), surfaceIds, groupIds });

const nested = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 20, 0), surf('c', 40, 0)),
  groups: [groupOf('g-1')],
  layers: [sn('a'), gn('g-1', sn('b'), sn('c'))],
});

describe('groupItems', () => {
  it('puts the group where the first item was', () => {
    const out = groupItems(three(), ['c', 'a'], 'g-1')!;
    expect(out.layers).toEqual([gn('g-1', sn('a'), sn('c')), sn('b')]);
    expect(out.groups[0]).toMatchObject({ id: 'g-1', name: 'グループ 1', visible: true, origin: [0, 0] });
  });
  it('infers the layout from the arrangement', () => {
    expect(groupItems(three(), ['a', 'b', 'c'], 'g-1')!.groups[0]?.layout).toEqual({ direction: 'row', gap: 10, align: 'start', padding: 0 });
  });
  it('groups a single item', () => {
    expect(groupItems(three(), ['b'], 'g-1')!.layers).toEqual([sn('a'), gn('g-1', sn('b')), sn('c')]);
  });
  it('is null across parents and for an empty list', () => {
    expect(groupItems(nested(), ['a', 'b'], 'g-2')).toBeNull();
    expect(groupItems(three(), [], 'g-1')).toBeNull();
  });
  it('groups inside a group', () => {
    const out = groupItems(nested(), ['b', 'c'], 'g-2')!;
    expect(out.layers).toEqual([sn('a'), gn('g-1', gn('g-2', sn('b'), sn('c')))]);
  });
});

describe('ungroupItems', () => {
  it('replaces the group by its children at the same index', () => {
    const grouped = groupItems(three(), ['b', 'c'], 'g-1')!;
    const { mapping, childIds } = ungroupItems(grouped, ['g-1']);
    expect(mapping.layers).toEqual([sn('a'), sn('b'), sn('c')]);
    expect(mapping.groups).toEqual([]);
    expect(mapping.surfaces).toEqual(grouped.surfaces);
    expect(childIds).toEqual(['b', 'c']);
  });
  it('reports nested children by id', () => {
    const wrapped: Mapping = { ...nested(), groups: [groupOf('g-1'), groupOf('g-2')], layers: [gn('g-1', gn('g-2', sn('a')), sn('b')), sn('c')] };
    const { mapping, childIds } = ungroupItems(wrapped, ['g-1']);
    expect(mapping.layers).toEqual([gn('g-2', sn('a')), sn('b'), sn('c')]);
    expect(childIds).toEqual(['g-2', 'b']);
  });
});

describe('groupProblem', () => {
  it('is empty when nothing is selected', () => {
    expect(groupProblem(three(), select([]))).toBe('');
  });
  it('asks for one level when parents differ', () => {
    expect(groupProblem(nested(), select(['a', 'b']))).toBe('同じ階層のものを選んでください');
  });
  it('accepts one surface or siblings', () => {
    expect(groupProblem(three(), select(['a']))).toBeNull();
    expect(groupProblem(nested(), select(['b', 'c']))).toBeNull();
    expect(groupProblem(nested(), select(['a'], ['g-1']))).toBeNull();
  });
  it('refuses to nest deeper than the tree limit', () => {
    const chain = Array.from({ length: MAX_TREE_DEPTH - 1 }, (_, i) => `g-${i + 1}`);
    const layers = chain.reduceRight<LayerNode>((inner, id) => gn(id, inner), sn('a'));
    const m: Mapping = { ...mapOf(surf('a', 0, 0)), groups: chain.map((id) => groupOf(id)), layers: [layers] };
    expect(groupProblem(m, select(['a']))).toBe('これ以上深い階層にはできません（16 階層まで）');
    const shallower: Mapping = { ...m, groups: m.groups.slice(1), layers: [chain.slice(1).reduceRight<LayerNode>((inner, id) => gn(id, inner), sn('a'))] };
    expect(groupProblem(shallower, select(['a']))).toBeNull();
  });
});

describe('ungroup a hidden group', () => {
  it('hides the moved children so the drawing does not change', () => {
    const m: Mapping = {
      ...mapOf(surf('a', 0, 0), surf('b', 20, 0)),
      groups: [groupOf('g-1', { visible: false }), groupOf('g-2')],
      layers: [gn('g-1', sn('a'), gn('g-2', sn('b')))],
    };
    const { mapping } = ungroupItems(m, ['g-1']);
    expect(mapping.surfaces.map((x) => x.visible)).toEqual([false, true]);
    expect(mapping.groups.find((g) => g.id === 'g-2')?.visible).toBe(false);
  });
});
