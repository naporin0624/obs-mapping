import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { Mapping } from '../../model/mapping';
import { selectionOfKeys } from './selection';

const sample = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 0, 0), surf('c', 0, 0)),
  groups: [groupOf('g1', { visible: false }), groupOf('g2')],
  layers: [gn('g1', sn('a'), gn('g2', sn('b'))), sn('c')],
});

describe('selectionOfKeys', () => {
  it('splits keys by kind and selects everything for all', () => {
    expect(selectionOfKeys(sample(), new Set(['a', 'g2']))).toEqual({ surfaceIds: ['a'], groupIds: ['g2'], corner: null });
    expect(selectionOfKeys(sample(), 'all')).toEqual({ surfaceIds: ['a', 'b', 'c'], groupIds: ['g1', 'g2'], corner: null });
  });
});
