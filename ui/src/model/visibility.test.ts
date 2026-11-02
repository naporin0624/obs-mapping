import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { Mapping } from './mapping';
import { effectiveVisibleIds, hiddenByAncestor } from './visibility';

const withTree = (hidden: string[], layers: ReturnType<typeof gn>[], groupIds: string[], surfaces = [surf('s-1', 0, 0), surf('s-2', 0, 0)]) => ({
  ...mapOf(...surfaces),
  groups: groupIds.map((id) => groupOf(id, { visible: !hidden.includes(id) })),
  layers,
});

describe('effectiveVisibleIds', () => {
  it('hides surfaces under a hidden group', () => {
    const m = withTree(['g-1'], [gn('g-1', sn('s-1'))], ['g-1']);
    expect(effectiveVisibleIds({ ...m, layers: [...m.layers, sn('s-2')] })).toEqual(new Set(['s-2']));
  });

  it('needs every ancestor to be visible', () => {
    const m = withTree(['g-1'], [gn('g-1', gn('g-2', sn('s-1')))], ['g-1', 'g-2'], [surf('s-1', 0, 0)]);
    expect(effectiveVisibleIds(m)).toEqual(new Set());
    expect(effectiveVisibleIds(withTree([], m.layers, ['g-1', 'g-2'], [surf('s-1', 0, 0)]))).toEqual(new Set(['s-1']));
  });

  it('keeps the surface own flag', () => {
    const hiddenSurface = { ...surf('s-1', 0, 0), visible: false };
    const m = withTree([], [gn('g-1', sn('s-1'))], ['g-1'], [hiddenSurface]);
    expect(effectiveVisibleIds(m)).toEqual(new Set());
  });
});

const hiddenSample = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 0, 0), surf('c', 0, 0)),
  groups: [groupOf('g1', { visible: false }), groupOf('g2')],
  layers: [gn('g1', sn('a'), gn('g2', sn('b'))), sn('c')],
});

describe('hiddenByAncestor', () => {
  it('lists visible nodes under a hidden group', () => {
    expect([...hiddenByAncestor(hiddenSample())].sort()).toEqual(['a', 'b', 'g2']);
  });
});
