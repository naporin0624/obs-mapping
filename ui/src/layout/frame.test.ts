import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { Group, LayerNode, Mapping, Surface } from '../model/mapping';
import { groupFrame, nodeSize } from './frame';

const build = (surfaces: Surface[], groups: Group[], layers: LayerNode[]): Mapping => ({ ...mapOf(...surfaces), groups, layers });

describe('frame', () => {
  it('sizes a surface by its bounding box', () => {
    const m = mapOf(surf('a', 5, 5, 100, 50));
    expect(nodeSize(m, sn('a'))).toEqual({ width: 100, height: 50 });
  });

  it('returns null for hidden nodes', () => {
    const m = build([{ ...surf('a', 0, 0), visible: false }], [groupOf('g', { visible: false })], [gn('g', sn('a'))]);
    expect(nodeSize(m, sn('a'))).toBeNull();
    expect(nodeSize(m, gn('g', sn('a')))).toBeNull();
  });

  it('sizes a row group by content plus padding', () => {
    const m = build([surf('a', 0, 0, 100, 50), surf('b', 0, 0, 100, 80)], [groupOf('g', { layout: { direction: 'row', gap: 20, align: 'start', padding: 10 } })], [gn('g', sn('a'), sn('b'))]);
    expect(nodeSize(m, m.layers[0]!)).toEqual({ width: 240, height: 100 });
  });

  it('sizes empty and all-hidden groups as padding only', () => {
    const layout = { direction: 'row', gap: 7, align: 'start', padding: 6 } as const;
    const m = build([{ ...surf('a', 0, 0), visible: false }], [groupOf('e', { layout }), groupOf('h', { layout })], [gn('e'), gn('h', sn('a'))]);
    expect(nodeSize(m, m.layers[0]!)).toEqual({ width: 12, height: 12 });
    expect(nodeSize(m, m.layers[1]!)).toEqual({ width: 12, height: 12 });
  });

  it('groupFrame places the size at the origin', () => {
    const m = build([surf('a', 0, 0, 30, 20)], [groupOf('g', { origin: [100, 200], layout: { direction: 'row', gap: 0, align: 'start', padding: 5 } })], [gn('g', sn('a'))]);
    expect(groupFrame(m, 'g')).toEqual({ x: 100, y: 200, width: 40, height: 30 });
  });
});
