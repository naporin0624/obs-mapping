import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import { validateTree } from './validate-tree';

const surfaces = [surf('s-1', 0, 0), surf('s-2', 20, 0)];
const valid = () => ({ ...mapOf(...surfaces), groups: [groupOf('g-1', { origin: [100, 100] })], layers: [gn('g-1', sn('s-1')), sn('s-2')] });
const withLayout = (patch: Record<string, unknown>) => ({ ...valid(), groups: [{ ...groupOf('g-1'), layout: { ...groupOf('g-1').layout, ...patch } }] });
const withGroup = (patch: Record<string, unknown>) => ({ ...valid(), groups: [{ ...groupOf('g-1'), ...patch }] });
const chain = (n: number) => {
  const ids = Array.from({ length: n }, (_, i) => `g-${String(i + 1)}`);
  const layers = ids.reduceRight<ReturnType<typeof gn> | null>((inner, id) => (inner === null ? gn(id) : gn(id, inner)), null);
  return { surfaces: [], groups: ids.map((id) => groupOf(id)), layers: layers === null ? [] : [layers] };
};

describe('validateTree', () => {
  it('accepts a valid tree, an empty group and the boundary values', () => {
    expect(validateTree(valid())).toBeNull();
    expect(validateTree({ ...valid(), layers: [gn('g-1'), sn('s-1'), sn('s-2')] })).toBeNull();
    expect(validateTree(withLayout({ gap: 0, padding: 4096 }))).toBeNull();
    expect(validateTree(withLayout({ gap: 4096, padding: 0 }))).toBeNull();
  });

  it('accepts a group without visible and with unknown fields', () => {
    const { visible: _v, ...noVisible } = groupOf('g-1');
    expect(validateTree({ ...valid(), groups: [{ ...noVisible, extra: 1 }] })).toBeNull();
  });

  it('requires groups and layers', () => {
    const { groups: _g, ...noGroups } = valid();
    const { layers: _l, ...noLayers } = valid();
    expect(validateTree(noGroups)).toBe('groups: missing');
    expect(validateTree(noLayers)).toBe('layers: missing');
    expect(validateTree({ ...valid(), groups: {} })).toBe('groups: expected array');
    expect(validateTree({ ...valid(), layers: {} })).toBe('layers: expected array');
  });

  it('reports a repeated surface id as a duplicate', () => {
    expect(validateTree({ ...valid(), surfaces: [surf('a', 0, 0), surf('a', 0, 0)], groups: [], layers: [sn('a')] })).toBe('surfaces[1].id: duplicate id "a"');
  });

  it('rejects duplicate ids across groups and surfaces', () => {
    expect(validateTree({ ...valid(), groups: [groupOf('s-1')] })).toBe('groups[0].id: duplicate id "s-1"');
    expect(validateTree({ ...valid(), groups: [groupOf('g-1'), groupOf('g-1')] })).toBe('groups[1].id: duplicate id "g-1"');
    expect(validateTree(withGroup({ id: '' }))).toBe('groups[0].id: must not be empty');
  });

  it('rejects out-of-range gap and padding', () => {
    for (const bad of [-1, 4097]) {
      expect(validateTree(withLayout({ gap: bad }))).toBe('groups[0].layout.gap: must be between 0 and 4096');
      expect(validateTree(withLayout({ padding: bad }))).toBe('groups[0].layout.padding: must be between 0 and 4096');
    }
  });

  it('rejects unknown direction and align', () => {
    expect(validateTree(withLayout({ direction: 'wrap' }))).toBe('groups[0].layout.direction: unknown direction "wrap"');
    expect(validateTree(withLayout({ align: 'stretch' }))).toBe('groups[0].layout.align: unknown align "stretch"');
  });

  it('requires name, origin and every layout field', () => {
    const { name: _n, ...noName } = groupOf('g-1');
    const { origin: _o, ...noOrigin } = groupOf('g-1');
    const { gap: _gap, ...noGap } = groupOf('g-1').layout;
    expect(validateTree({ ...valid(), groups: [noName] })).toBe('groups[0].name: missing');
    expect(validateTree({ ...valid(), groups: [noOrigin] })).toBe('groups[0].origin: missing');
    expect(validateTree(withGroup({ origin: [1] }))).toBe('groups[0].origin: expected [x, y]');
    expect(validateTree(withGroup({ layout: noGap }))).toBe('groups[0].layout.gap: missing');
    expect(validateTree(withGroup({ layout: 3 }))).toBe('groups[0].layout: expected object');
    expect(validateTree(withGroup({ visible: 'yes' }))).toBe('groups[0].visible: expected boolean');
  });

  it('rejects malformed nodes', () => {
    expect(validateTree({ ...valid(), layers: [{ surface: 's-1', group: 'g-1', children: [] }, sn('s-2')] })).toBe('layers[0]: expected exactly one of "surface" or "group"');
    expect(validateTree({ ...valid(), layers: [{}, sn('s-2')] })).toBe('layers[0]: expected exactly one of "surface" or "group"');
    expect(validateTree({ ...valid(), layers: [{ group: 'g-1' }, sn('s-2')] })).toBe('layers[0].children: missing');
    expect(validateTree({ ...valid(), layers: [{ group: 'g-1', children: {} }, sn('s-2')] })).toBe('layers[0].children: expected array');
  });

  it('rejects unknown and repeated references', () => {
    expect(validateTree({ ...valid(), layers: [gn('g-1', sn('s-1')), sn('s-9')] })).toBe('layers[1].surface: unknown surface "s-9"');
    expect(validateTree({ ...valid(), layers: [gn('g-9', sn('s-1')), sn('s-2')] })).toBe('layers[0].group: unknown group "g-9"');
    expect(validateTree({ ...valid(), layers: [gn('g-1', sn('s-1')), sn('s-1')] })).toBe('layers[1].surface: surface "s-1" appears more than once');
  });

  it('rejects anything missing from the tree', () => {
    expect(validateTree({ ...valid(), layers: [gn('g-1', sn('s-1'))] })).toBe('layers: surface "s-2" is missing from the tree');
    expect(validateTree({ ...valid(), groups: [groupOf('g-1'), groupOf('g-2')] })).toBe('layers: group "g-2" is missing from the tree');
  });

  it('rejects surfaces that are not in depth-first order', () => {
    expect(validateTree({ ...valid(), surfaces: [...surfaces].reverse() })).toBe('surfaces: order must match the depth-first order of layers');
  });

  it('allows 16 levels and rejects 17 with the node path', () => {
    expect(validateTree(chain(16))).toBeNull();
    expect(validateTree(chain(17))).toBe(`layers[0]${'.children[0]'.repeat(16)}: depth exceeds 16`);
  });
});
