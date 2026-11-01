import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { MappingV1 } from './mapping';
import { readMapping, upgradeV1 } from './read';

const v1 = (): MappingV1 => ({ version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: 10 }, surfaces: [surf('a', 0, 0), surf('b', 20, 0)] });

describe('upgradeV1', () => {
  it('keeps every field and puts all surfaces at the top level', () => {
    const up = upgradeV1(v1());
    expect(up).toEqual({ ...v1(), version: 2, groups: [], layers: [sn('a'), sn('b')] });
  });
});

describe('readMapping', () => {
  it('reads a v1 JSON as a flat v2', () => {
    const r = readMapping(JSON.parse(JSON.stringify(v1())));
    expect(r.kind === 'ok' && r.mapping.version).toBe(2);
    expect(r.kind === 'ok' && r.mapping.layers).toEqual([sn('a'), sn('b')]);
  });

  it('reads a valid v2 as is', () => {
    const m = { ...mapOf(surf('a', 0, 0)), groups: [groupOf('g')], layers: [gn('g', sn('a'))] };
    expect(readMapping(JSON.parse(JSON.stringify(m)))).toEqual({ kind: 'ok', mapping: m });
  });

  it('rejects an unsupported version', () => {
    expect(readMapping({ ...v1(), version: 3 })).toEqual({ kind: 'error', message: 'version: unsupported version 3' });
    expect(readMapping({ ...v1(), version: '2' })).toEqual({ kind: 'error', message: 'version: expected integer' });
  });

  it('rejects a missing version, a bad canvas and non-array surfaces', () => {
    const { version: _v, ...noVersion } = v1();
    expect(readMapping(noVersion)).toEqual({ kind: 'error', message: 'version: missing' });
    expect(readMapping({ ...v1(), canvas: { width: 0, height: 10 } })).toEqual({ kind: 'error', message: 'canvas.width: expected a positive number' });
    expect(readMapping({ ...v1(), surfaces: {} })).toEqual({ kind: 'error', message: 'surfaces: expected an array' });
    expect(readMapping([])).toEqual({ kind: 'error', message: 'json: expected an object' });
  });

  it('requires layers in v2 and reports tree errors', () => {
    const { layers: _l, ...noLayers } = mapOf(surf('a', 0, 0));
    expect(readMapping(noLayers)).toEqual({ kind: 'error', message: 'layers: missing' });
    expect(readMapping({ ...mapOf(surf('a', 0, 0)), layers: [] })).toEqual({ kind: 'error', message: 'layers: surface "a" is missing from the tree' });
  });
});
