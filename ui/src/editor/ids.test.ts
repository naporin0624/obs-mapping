import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import { freshId } from './ids';

describe('freshId', () => {
  it('counts group ids and surface ids in one namespace', () => {
    const m = { ...mapOf(surf('s-1', 0, 0)), groups: [groupOf('s-3')], layers: [sn('s-1'), gn('s-3')] };
    expect(freshId(m, 's')).toBe('s-4');
  });
  it('numbers each prefix on its own', () => {
    const m = mapOf(surf('s-7', 0, 0));
    expect(freshId(m, 'g')).toBe('g-1');
  });
  it('avoids ids already taken', () => {
    expect(freshId(mapOf(), 's', new Set(['s-1', 's-2']))).toBe('s-3');
  });
});
