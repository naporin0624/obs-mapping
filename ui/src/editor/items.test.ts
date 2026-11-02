import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { LayerNode, Mapping } from '../model/mapping';
import { isLaidOut, leadingRoot, movableItems, moveItem } from './items';

const withLayers = (layers: LayerNode[], hiddenIds: string[] = []): Mapping => {
  const m = mapOf(surf('a', 0, 0), surf('b', 0, 0), surf('c', 0, 0), surf('x', 0, 0));
  return {
    ...m,
    surfaces: m.surfaces.map((s) => (hiddenIds.includes(s.id) ? { ...s, visible: false } : s)),
    groups: [groupOf('g'), groupOf('h')],
    layers,
  };
};

describe('isLaidOut', () => {
  it('is true only when the parent is a group', () => {
    const m = withLayers([gn('g', sn('a')), sn('x')]);
    expect(isLaidOut(m, 'a')).toBe(true);
    expect(isLaidOut(m, 'x')).toBe(false);
    expect(isLaidOut(m, 'missing')).toBe(false);
  });
});

describe('leadingRoot', () => {
  it('returns the top-level group for a first child', () => {
    expect(leadingRoot(withLayers([gn('g', sn('a'), sn('b'))]), 'a')).toBe('g');
  });
  it('is null for a non-first child and for top-level surfaces', () => {
    const m = withLayers([gn('g', sn('a'), sn('b')), sn('x')]);
    expect(leadingRoot(m, 'b')).toBeNull();
    expect(leadingRoot(m, 'x')).toBeNull();
  });
  it('requires leading position at every level', () => {
    expect(leadingRoot(withLayers([gn('g', gn('h', sn('a'), sn('b')), sn('c'))]), 'a')).toBe('g');
    expect(leadingRoot(withLayers([gn('g', sn('c'), gn('h', sn('a')))]), 'a')).toBeNull();
  });
  it('does not require the top-level group to be first in layers', () => {
    expect(leadingRoot(withLayers([sn('x'), gn('g', sn('a'), sn('b'))]), 'a')).toBe('g');
  });
  it('skips hidden siblings', () => {
    expect(leadingRoot(withLayers([gn('g', sn('c'), sn('a'))], ['c']), 'a')).toBe('g');
  });
});

describe('movableItems / moveItem', () => {
  const m = (): Mapping => {
    const base = mapOf(surf('a', 100, 100, 50, 20), surf('b', 150, 100, 50, 20), surf('x', 400, 0, 10, 10));
    return {
      ...base,
      groups: [groupOf('g', { origin: [100, 100] }), groupOf('h')],
      layers: [gn('g', sn('a'), gn('h', sn('b'))), sn('x')],
    };
  };
  const sel = (surfaceIds: string[], groupIds: string[] = []) => ({ surfaceIds, groupIds, corner: null });

  it('lists top-level surfaces and groups with their frames', () => {
    const items = movableItems(m(), sel(['a', 'x'], ['g', 'h']));
    expect(items.map((i) => i.id).sort()).toEqual(['g', 'x']);
    expect(items.find((i) => i.id === 'g')?.bounds).toMatchObject({ x: 100, y: 100 });
  });
  it('moveItem translates a surface or shifts a group origin', () => {
    expect(moveItem(m(), 'x', [1, 2]).surfaces.find((s) => s.id === 'x')?.corners[0]).toEqual([401, 2]);
    expect(moveItem(m(), 'g', [1, 2]).groups.find((g) => g.id === 'g')?.origin).toEqual([101, 102]);
  });
  it('moveItem ignores grouped surfaces and nested groups', () => {
    const base = m();
    expect(moveItem(base, 'a', [1, 2])).toBe(base);
    expect(moveItem(base, 'h', [1, 2])).toBe(base);
  });
});
