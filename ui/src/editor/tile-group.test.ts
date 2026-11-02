import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import { boundsOf } from '../geometry/rect';
import { layoutTree } from '../layout/layout-tree';
import type { Mapping } from '../model/mapping';
import type { Selection } from './state';
import { groupTiling, tiledGroup, tileTarget } from './tile-group';

const column = groupOf('g', { origin: [100, 100], layout: { direction: 'column', gap: 20, align: 'center', padding: 8 } });

const world = (): Mapping => ({
  ...mapOf(surf('a', 108, 108, 100, 50), surf('b', 108, 178, 80, 80), surf('x', 600, 300, 20, 20)),
  groups: [column],
  layers: [gn('g', sn('a'), sn('b')), sn('x')],
});

const nested = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 20, 0)),
  groups: [groupOf('outer'), groupOf('inner')],
  layers: [gn('outer', sn('a'), gn('inner', sn('b')))],
});

const pick = (surfaceIds: string[], groupIds: string[]): Selection => ({ surfaceIds, groupIds, corner: null });

const boundsById = (m: Mapping, id: string) => {
  const s = m.surfaces.find((x) => x.id === id);
  return s === undefined ? null : boundsOf(s);
};

describe('groupTiling', () => {
  it('gives the visible direct surfaces in layer order', () => {
    expect(groupTiling(world(), 'g')).toEqual({ kind: 'ok', ids: ['a', 'b'] });
  });
  it('leaves hidden surfaces out because layout does not place them', () => {
    const m = world();
    const hidden = { ...m, surfaces: m.surfaces.map((s) => (s.id === 'a' ? { ...s, visible: false } : s)) };
    expect(groupTiling(hidden, 'g')).toEqual({ kind: 'ok', ids: ['b'] });
  });
  it('refuses a group inside another group', () => {
    expect(groupTiling(nested(), 'inner')).toEqual({ kind: 'blocked', why: 'nested' });
  });
  it('refuses a group that holds a sub-group', () => {
    expect(groupTiling(nested(), 'outer')).toEqual({ kind: 'blocked', why: 'subgroup' });
  });
  it('refuses a group without a visible surface', () => {
    const m: Mapping = { ...mapOf(), groups: [groupOf('e')], layers: [gn('e')] };
    expect(groupTiling(m, 'e')).toEqual({ kind: 'blocked', why: 'empty' });
  });
});

describe('tileTarget', () => {
  it('tiles the selected top-level surfaces', () => {
    expect(tileTarget(world(), pick(['x', 'a'], []))).toEqual({ kind: 'surfaces', count: 1 });
  });
  it('is blocked without a top-level surface', () => {
    expect(tileTarget(world(), pick(['a'], []))).toEqual({ kind: 'blocked', why: 'noSurface' });
    expect(tileTarget(world(), pick([], []))).toEqual({ kind: 'blocked', why: 'noSurface' });
  });
  it('fits one selected group with its count and current direction', () => {
    expect(tileTarget(world(), pick([], ['g']))).toEqual({ kind: 'group', groupId: 'g', count: 2, direction: 'column' });
  });
  it('asks for a single group when a group is mixed with other items', () => {
    expect(tileTarget(world(), pick(['x'], ['g']))).toEqual({ kind: 'blocked', why: 'mixed' });
    expect(tileTarget(nested(), pick([], ['outer', 'inner']))).toEqual({ kind: 'blocked', why: 'mixed' });
  });
  it('passes on why a single group cannot be tiled', () => {
    expect(tileTarget(nested(), pick([], ['inner']))).toEqual({ kind: 'blocked', why: 'nested' });
    expect(tileTarget(nested(), pick([], ['outer']))).toEqual({ kind: 'blocked', why: 'subgroup' });
  });
});

describe('tiledGroup', () => {
  it('splits the canvas along the direction and resizes each child to its cell', () => {
    const m = tiledGroup(world(), 'g', { direction: 'row', gap: 0 });
    expect(boundsById(m, 'a')).toEqual({ x: 0, y: 0, width: 960, height: 1080 });
    expect(boundsById(m, 'b')).toEqual({ x: 960, y: 0, width: 960, height: 1080 });
    expect(boundsById(m, 'x')).toEqual({ x: 600, y: 300, width: 20, height: 20 });
  });
  it('makes the group flow the same way from the canvas origin without padding', () => {
    const g = tiledGroup(world(), 'g', { direction: 'row', gap: 12 }).groups[0];
    expect(g?.origin).toEqual([0, 0]);
    expect(g?.layout).toEqual({ direction: 'row', gap: 12, align: 'start', padding: 0 });
  });
  it('stacks a column with the gap between cells', () => {
    const m = tiledGroup(world(), 'g', { direction: 'column', gap: 20 });
    expect(boundsById(m, 'a')).toEqual({ x: 0, y: 0, width: 1920, height: 530 });
    expect(boundsById(m, 'b')).toEqual({ x: 0, y: 550, width: 1920, height: 530 });
  });
  it('is already where the group layout would place it', () => {
    const m = tiledGroup(world(), 'g', { direction: 'row', gap: 20 });
    expect(layoutTree(m).surfaces).toEqual(m.surfaces);
  });
  it('drops the warp of a child', () => {
    const m = world();
    const warped = {
      ...m,
      surfaces: m.surfaces.map((s) =>
        s.id === 'a'
          ? {
              ...s,
              corners: [
                [110, 108],
                [208, 120],
                [200, 158],
                [108, 150],
              ] as const,
            }
          : s,
      ),
    };
    expect(tiledGroup(warped, 'g', { direction: 'row', gap: 0 }).surfaces.find((s) => s.id === 'a')?.corners).toEqual([
      [0, 0],
      [960, 0],
      [960, 1080],
      [0, 1080],
    ]);
  });
  it.each([
    ['a nested group', nested(), 'inner'],
    ['a group with a sub-group', nested(), 'outer'],
    ['an unknown group', world(), 'nope'],
  ])('leaves %s untouched', (_name, m, id) => {
    expect(tiledGroup(m, id, { direction: 'row', gap: 0 })).toBe(m);
  });
  it('leaves the mapping untouched when the gap leaves no room', () => {
    const m = world();
    expect(tiledGroup(m, 'g', { direction: 'row', gap: 5000 })).toBe(m);
  });
});
