import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import { inferGroup } from './group-inference';

describe('inferGroup', () => {
  it('reads a horizontal strip as a row with the average gap', () => {
    const m = mapOf(surf('a', 0, 0, 100, 50), surf('b', 130, 0, 100, 50), surf('c', 250, 0, 100, 50));
    const out = inferGroup(m, ['a', 'b', 'c']);
    expect(out.layout).toEqual({ direction: 'row', gap: 25, align: 'start', padding: 0 });
    expect(out.origin).toEqual([0, 0]);
    expect(out.order).toEqual(['a', 'b', 'c']);
  });
  it('clamps an overlap to a zero gap', () => {
    const m = mapOf(surf('a', 0, 0, 100, 50), surf('b', 80, 0, 100, 50));
    expect(inferGroup(m, ['a', 'b']).layout.gap).toBe(0);
  });
  it('reads a tall selection as a column', () => {
    const m = mapOf(surf('a', 5, 10, 50, 100), surf('b', 5, 130, 50, 100));
    const out = inferGroup(m, ['a', 'b']);
    expect(out.layout).toMatchObject({ direction: 'column', gap: 20 });
    expect(out.origin).toEqual([5, 10]);
  });
  it('orders by position, not by selection order', () => {
    const m = mapOf(surf('a', 0, 0), surf('b', 50, 0), surf('c', 100, 0));
    expect(inferGroup(m, ['c', 'a', 'b']).order).toEqual(['a', 'b', 'c']);
  });
  it('keeps tree order for equal positions', () => {
    const m = mapOf(surf('a', 0, 0), surf('b', 0, 0));
    expect(inferGroup(m, ['b', 'a']).order).toEqual(['a', 'b']);
  });
  it('has no gap for a single item', () => {
    expect(inferGroup(mapOf(surf('a', 7, 9)), ['a']).layout.gap).toBe(0);
  });
  it('uses the padded frame for a group item', () => {
    const m = {
      ...mapOf(surf('a', 0, 0, 10, 10), surf('b', 100, 0, 10, 10)),
      groups: [groupOf('g', { origin: [0, 0], layout: { direction: 'row' as const, gap: 0, align: 'start' as const, padding: 5 } })],
      layers: [gn('g', sn('a')), sn('b')],
    };
    const out = inferGroup(m, ['g', 'b']);
    expect(out.layout.gap).toBe(80);
  });
  it('ignores hidden items for gap and origin but still orders them', () => {
    const hidden = { ...surf('b', 130, 0, 100, 50), visible: false };
    const m = mapOf(surf('a', 0, 0, 100, 50), hidden, surf('c', 250, 0, 100, 50));
    const out = inferGroup(m, ['a', 'b', 'c']);
    expect(out.layout.gap).toBe(150);
    expect(out.order).toEqual(['a', 'b', 'c']);
    const leadingHidden = mapOf({ ...surf('a', 0, 0, 100, 50), visible: false }, surf('b', 130, 0, 100, 50));
    expect(inferGroup(leadingHidden, ['a', 'b']).origin).toEqual([130, 0]);
  });
  it('falls back to all items when every one is hidden', () => {
    const m = mapOf({ ...surf('a', 0, 0, 100, 50), visible: false }, { ...surf('b', 130, 0, 100, 50), visible: false });
    expect(inferGroup(m, ['a', 'b']).layout.gap).toBe(30);
  });
  it('caps the gap at the plugin limit', () => {
    const m = mapOf(surf('a', 0, 0, 100, 50), surf('b', 5100, 0, 100, 50));
    expect(inferGroup(m, ['a', 'b']).layout.gap).toBe(4096);
  });
});
