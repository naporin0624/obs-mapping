import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { Mapping } from '../model/mapping';
import { duplicateItems, removeItems } from './structure';

const tree = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 20, 0), surf('c', 40, 0), surf('d', 60, 0)),
  groups: [groupOf('g-1', { origin: [5, 5] })],
  layers: [gn('g-1', sn('a'), sn('b')), sn('c'), sn('d')],
});

const surfaceIds = (m: Mapping): string[] => m.surfaces.map((x) => x.id);

describe('removeItems', () => {
  it('removes a group with its children from surfaces, groups and layers', () => {
    const out = removeItems(tree(), ['g-1']);
    expect(surfaceIds(out)).toEqual(['c', 'd']);
    expect(out.groups).toEqual([]);
    expect(out.layers).toEqual([sn('c'), sn('d')]);
  });
  it('keeps a group whose children were all removed', () => {
    const out = removeItems(tree(), ['a', 'b']);
    expect(out.layers[0]).toEqual(gn('g-1'));
    expect(out.groups.map((g) => g.id)).toEqual(['g-1']);
  });
  it('treats a group selected with its child as the group alone', () => {
    const out = removeItems(tree(), ['a', 'g-1']);
    expect(surfaceIds(out)).toEqual(['c', 'd']);
    expect(out.groups).toEqual([]);
  });
});

describe('duplicateItems', () => {
  it('copies a top-level group deeply right after it, offsetting origin and surfaces', () => {
    const { mapping, newSurfaceIds, newGroupIds } = duplicateItems(tree(), ['g-1']);
    expect(newGroupIds).toEqual(['g-2']);
    expect(newSurfaceIds).toEqual([]);
    expect(mapping.layers).toEqual([gn('g-1', sn('a'), sn('b')), gn('g-2', sn('s-1'), sn('s-2')), sn('c'), sn('d')]);
    expect(surfaceIds(mapping)).toEqual(['a', 'b', 's-1', 's-2', 'c', 'd']);
    const copy = mapping.groups.find((g) => g.id === 'g-2');
    expect(copy).toMatchObject({ name: 'g-1 のコピー', origin: [25, 25] });
    expect(mapping.surfaces[2]).toMatchObject({
      id: 's-1',
      name: 'a',
      corners: [
        [20, 20],
        [30, 20],
        [30, 30],
        [20, 30],
      ],
    });
  });
  it('gives every copied id a fresh value that collides with nothing', () => {
    const { mapping } = duplicateItems(tree(), ['g-1']);
    const all = [...surfaceIds(mapping), ...mapping.groups.map((g) => g.id)];
    expect(new Set(all).size).toBe(all.length);
  });
  it('copies nested groups and renames only the top copy', () => {
    const m: Mapping = {
      ...mapOf(surf('a', 0, 0)),
      groups: [groupOf('g-1'), groupOf('g-2')],
      layers: [gn('g-1', gn('g-2', sn('a')))],
    };
    const { mapping, newGroupIds } = duplicateItems(m, ['g-1']);
    expect(newGroupIds).toEqual(['g-3']);
    expect(mapping.layers[1]).toEqual(gn('g-3', gn('g-4', sn('s-1'))));
    expect(mapping.groups.find((g) => g.id === 'g-4')?.name).toBe('g-2');
    expect(mapping.groups.find((g) => g.id === 'g-3')?.name).toBe('g-1 のコピー');
  });
  it('does not offset a copy made inside a group', () => {
    const { mapping, newSurfaceIds } = duplicateItems(tree(), ['a']);
    expect(newSurfaceIds).toEqual(['s-1']);
    expect(mapping.layers[0]).toEqual(gn('g-1', sn('a'), sn('s-1'), sn('b')));
    expect(mapping.surfaces[1]).toMatchObject({ id: 's-1', name: 'a のコピー', corners: surf('a', 0, 0).corners });
  });
  it('copies a group once when it is selected with its child', () => {
    const { mapping, newSurfaceIds, newGroupIds } = duplicateItems(tree(), ['a', 'g-1']);
    expect(newGroupIds).toEqual(['g-2']);
    expect(newSurfaceIds).toEqual([]);
    expect(mapping.groups).toHaveLength(2);
    expect(mapping.surfaces).toHaveLength(6);
  });
  it('gives several top copies distinct ids', () => {
    const { newSurfaceIds } = duplicateItems(tree(), ['c', 'd']);
    expect(newSurfaceIds).toEqual(['s-1', 's-2']);
  });
});
