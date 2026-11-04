import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { Mapping, Surface } from '../model/mapping';
import { bulkSourceOptions, bulkTargets, isBulkSelection, summarizeSources } from './bulk-source';
import type { Selection } from './state';

const sel = (surfaceIds: string[], groupIds: string[] = []): Selection => ({ surfaceIds, groupIds, corner: null });
const withSource = (s: Surface, source: string): Surface => ({ ...s, source });

const mapping = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 0, 0), surf('c', 0, 0), surf('d', 0, 0)),
  groups: [groupOf('g1'), groupOf('g2'), groupOf('empty')],
  layers: [gn('g1', sn('a'), gn('g2', sn('b'))), sn('c'), gn('empty'), sn('d')],
});

const ids = (targets: readonly Surface[]): string[] => targets.map((s) => s.id);

describe('isBulkSelection', () => {
  it.each([
    [sel([]), false],
    [sel(['a']), false],
    [sel([], ['g1']), false],
    [sel(['a', 'b']), true],
    [sel([], ['g1', 'g2']), true],
    [sel(['c'], ['g1']), true],
  ])('counts surfaces and groups together (%#)', (selection, expected) => {
    expect(isBulkSelection(selection)).toBe(expected);
  });
});

describe('bulkTargets', () => {
  it('includes surfaces of nested groups', () => {
    expect(ids(bulkTargets(mapping(), sel(['d'], ['g1'])))).toEqual(['a', 'b', 'd']);
  });
  it('lists a surface selected directly and through its group once', () => {
    expect(ids(bulkTargets(mapping(), sel(['b', 'a'], ['g2'])))).toEqual(['a', 'b']);
  });
  it('follows the layer tree order, not the selection order', () => {
    expect(ids(bulkTargets(mapping(), sel(['d', 'c', 'a'])))).toEqual(['a', 'c', 'd']);
  });
  it('is empty when only empty groups are selected', () => {
    expect(bulkTargets(mapping(), sel([], ['empty', 'empty']))).toEqual([]);
  });
});

describe('summarizeSources', () => {
  it('is the shared source when all targets use one', () => {
    expect(summarizeSources([surf('a', 0, 0), surf('b', 0, 0)])).toEqual({ kind: 'same', source: 'src' });
  });
  it('is the empty source when all targets are unassigned', () => {
    expect(summarizeSources([withSource(surf('a', 0, 0), ''), withSource(surf('b', 0, 0), '')])).toEqual({ kind: 'same', source: '' });
  });
  it('counts distinct sources when mixed, treating unassigned as one more kind', () => {
    const targets = [withSource(surf('a', 0, 0), 'cam-A'), withSource(surf('b', 0, 0), ''), withSource(surf('c', 0, 0), 'cam-A'), withSource(surf('d', 0, 0), 'cam-B')];
    expect(summarizeSources(targets)).toEqual({ kind: 'mixed', count: 3 });
  });
});

describe('bulkSourceOptions', () => {
  it('keeps the inputs when every target source is among them', () => {
    expect(bulkSourceOptions(['cam-A', 'cam-B'], [withSource(surf('a', 0, 0), 'cam-B')])).toEqual(['cam-A', 'cam-B']);
  });
  it('prepends target sources missing from the inputs once, skipping unassigned', () => {
    const targets = [withSource(surf('a', 0, 0), 'gone'), withSource(surf('b', 0, 0), ''), withSource(surf('c', 0, 0), 'gone')];
    expect(bulkSourceOptions(['cam-A'], targets)).toEqual(['gone', 'cam-A']);
  });
});
