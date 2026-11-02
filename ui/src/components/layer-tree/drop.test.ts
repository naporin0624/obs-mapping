import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { LayerNode, Mapping } from '../../model/mapping';
import { canDrop, dropAction } from './drop';

const sample = (): Mapping => ({
  ...mapOf(surf('s-in-g1', 0, 0), surf('s2', 0, 0), surf('s3', 0, 0)),
  groups: [groupOf('g1'), groupOf('g2')],
  layers: [gn('g1', sn('s-in-g1')), gn('g2', sn('s2')), sn('s3')],
});

const deep = (levels: number): Mapping => {
  const chain = Array.from({ length: levels }, (_, i) => `d${String(i)}`);
  const nested = chain.reduceRight<LayerNode[]>((inner, id) => [gn(id, ...inner)], []);
  return { ...mapOf(), groups: [...chain.map((id) => groupOf(id)), groupOf('mover')], layers: [...nested, gn('mover')] };
};

describe('canDrop', () => {
  it('rejects a group dropped next to or into its own descendant', () => {
    expect(canDrop(sample(), new Set(['g1']), { key: 's-in-g1', dropPosition: 'before' })).toBe(false);
    expect(canDrop(sample(), new Set(['g1']), { key: 'g1', dropPosition: 'on' })).toBe(false);
  });

  it('rejects an on-drop onto a surface and unknown keys', () => {
    expect(canDrop(sample(), new Set(['s3']), { key: 's2', dropPosition: 'on' })).toBe(false);
    expect(canDrop(sample(), new Set(['s3']), { key: 'nope', dropPosition: 'before' })).toBe(false);
    expect(canDrop(sample(), new Set(['nope']), { key: 's2', dropPosition: 'before' })).toBe(false);
  });

  it('accepts a sibling drop and a group on-drop', () => {
    expect(canDrop(sample(), new Set(['s3']), { key: 's-in-g1', dropPosition: 'after' })).toBe(true);
    expect(canDrop(sample(), new Set(['s3']), { key: 'g2', dropPosition: 'on' })).toBe(true);
  });

  it('rejects a group dropped into a depth-16 group but accepts one level less', () => {
    expect(canDrop(deep(16), new Set(['mover']), { key: 'd15', dropPosition: 'on' })).toBe(false);
    expect(canDrop(deep(15), new Set(['mover']), { key: 'd14', dropPosition: 'on' })).toBe(true);
  });
});

describe('dropAction', () => {
  it('appends to the last child on an on-drop', () => {
    expect(dropAction(sample(), new Set(['s3']), { key: 'g2', dropPosition: 'on' })).toEqual({ type: 'moveNodes', ids: ['s3'], target: { parentId: 'g2', index: 1 } });
  });

  it('inserts as a sibling of the key for before and after', () => {
    expect(dropAction(sample(), new Set(['s3']), { key: 's2', dropPosition: 'before' })).toEqual({ type: 'moveNodes', ids: ['s3'], target: { parentId: 'g2', index: 0 } });
    expect(dropAction(sample(), new Set(['s3']), { key: 's2', dropPosition: 'after' })).toEqual({ type: 'moveNodes', ids: ['s3'], target: { parentId: 'g2', index: 1 } });
  });

  it('returns null when the drop is not allowed', () => {
    expect(dropAction(sample(), new Set(['g1']), { key: 's-in-g1', dropPosition: 'before' })).toBeNull();
  });
});

describe('canDrop no-op moves', () => {
  it('rejects a drop that would leave the tree unchanged', () => {
    expect(canDrop(sample(), new Set(['g1']), { key: 'g2', dropPosition: 'before' })).toBe(false);
    expect(canDrop(sample(), new Set(['s3']), { key: 's3', dropPosition: 'after' })).toBe(false);
    expect(canDrop(sample(), new Set(['g1']), { key: 'g2', dropPosition: 'after' })).toBe(true);
  });
});
