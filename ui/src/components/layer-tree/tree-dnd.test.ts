import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { Mapping } from '../../model/mapping';
import { dropActionFor, dropOperationFor } from './tree-dnd';

const sample = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 0, 0), surf('c', 0, 0)),
  groups: [groupOf('g1', { visible: false }), groupOf('g2')],
  layers: [gn('g1', sn('a'), gn('g2', sn('b'))), sn('c')],
});

describe('dropOperationFor', () => {
  it('cancels root targets and invalid item targets, moves valid ones', () => {
    expect(dropOperationFor(sample(), new Set(['c']), { type: 'root' })).toBe('cancel');
    expect(dropOperationFor(sample(), new Set(['c']), { type: 'item', key: 'a', dropPosition: 'on' })).toBe('cancel');
    expect(dropOperationFor(sample(), new Set(['c']), { type: 'item', key: 'g1', dropPosition: 'on' })).toBe('move');
  });
});

describe('dropActionFor', () => {
  it('converts numeric keys to strings and returns null for root', () => {
    expect(dropActionFor(sample(), new Set<string | number>(['c']), { type: 'root' })).toBeNull();
    expect(dropActionFor(sample(), new Set<string | number>(['c']), { type: 'item', key: 'g1', dropPosition: 'on' })).toEqual({ type: 'moveNodes', ids: ['c'], target: { parentId: 'g1', index: 2 } });
  });
});
