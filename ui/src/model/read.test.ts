import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf, withMask } from '../geometry/fixtures';
import { canonicalJson } from '../editor/state';
import type { Mapping, MappingV1, Mask } from './mapping';
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

  it('defaults visible to true for surfaces and groups', () => {
    const m = { ...mapOf(surf('a', 0, 0)), groups: [groupOf('g')], layers: [gn('g', sn('a'))] };
    const { visible: _gv, ...group } = m.groups[0] ?? groupOf('g');
    const { visible: _sv, ...surface } = m.surfaces[0] ?? surf('a', 0, 0);
    const r = readMapping({ ...m, groups: [group], surfaces: [surface] });
    expect(r.kind === 'ok' && r.mapping.groups[0]?.visible).toBe(true);
    expect(r.kind === 'ok' && r.mapping.surfaces[0]?.visible).toBe(true);
  });

  it('drops unknown keys at the root, surface, group and layer node', () => {
    const m = { ...mapOf(surf('a', 0, 0)), groups: [groupOf('g')], layers: [gn('g', sn('a'))] };
    const noisy = {
      ...m,
      extra: 1,
      grid: { ...m.grid, extra: 1 },
      surfaces: m.surfaces.map((s) => ({ ...s, extra: 1 })),
      groups: m.groups.map((g) => ({ ...g, extra: 1, layout: { ...g.layout, extra: 1 } })),
      layers: [{ group: 'g', extra: 1, children: [{ surface: 'a', extra: 1 }] }],
    };
    expect(readMapping(noisy)).toEqual({ kind: 'ok', mapping: m });
  });

  it('reports malformed fields as an error instead of throwing', () => {
    const { crop: _c, ...noCrop } = surf('a', 0, 0);
    expect(readMapping({ ...v1(), surfaces: [noCrop] }).kind).toBe('error');
    expect(readMapping({ ...v1(), surfaces: [null] }).kind).toBe('error');
    expect(readMapping({ ...v1(), grid: null }).kind).toBe('error');
    const v2 = mapOf(surf('a', 0, 0));
    expect(readMapping({ ...v2, grid: null }).kind).toBe('error');
    expect(readMapping({ ...v2, surfaces: [null] }).kind).toBe('error');
  });

  it('lets the plugin report a wrong corner count', () => {
    const bad = { ...surf('a', 0, 0), corners: [[0, 0]] };
    expect(readMapping({ ...mapOf(surf('a', 0, 0)), surfaces: [bad] }).kind).toBe('ok');
  });
});

describe('readMapping mask', () => {
  const ellipse: Mask = { type: 'ellipse', x: 0.5, y: 0.5, width: 0.4, height: 0.2 };
  const polygon: Mask = {
    type: 'polygon',
    points: [
      [0, 0],
      [1, 0],
      [1.5, 1],
    ],
  };
  const roundTrip = (m: Mask) => readMapping(JSON.parse(JSON.stringify(mapOf(withMask(surf('a', 0, 0), m)))));

  it('reads ellipse and polygon masks', () => {
    expect(roundTrip(ellipse)).toEqual({ kind: 'ok', mapping: mapOf(withMask(surf('a', 0, 0), ellipse)) });
    expect(roundTrip(polygon)).toEqual({ kind: 'ok', mapping: mapOf(withMask(surf('a', 0, 0), polygon)) });
  });

  it('leaves no mask key on a surface without one', () => {
    const r = readMapping(JSON.parse(JSON.stringify(mapOf(surf('a', 0, 0)))));
    expect(r.kind === 'ok' && 'mask' in (r.mapping.surfaces[0] ?? {})).toBe(false);
  });

  it.each([
    [
      'two points',
      {
        type: 'polygon',
        points: [
          [0, 0],
          [1, 1],
        ],
      },
    ],
    ['65 points', { type: 'polygon', points: Array.from({ length: 65 }, (_, i) => [i, i]) }],
    ['zero width', { type: 'ellipse', x: 0, y: 0, width: 0, height: 1 }],
    ['unknown type', { type: 'star' }],
    ['short point', { type: 'polygon', points: [[0, 0], [1], [1, 1]] }],
    ['non-object', 5],
  ])('rejects %s', (_name, mask) => {
    const json = { ...mapOf(surf('a', 0, 0)), surfaces: [{ ...surf('a', 0, 0), mask }] };
    const r = readMapping(JSON.parse(JSON.stringify(json)));
    expect(r.kind === 'error' && r.message.startsWith('surfaces[0].mask')).toBe(true);
  });

  it('matches canonicalJson of a plugin-shaped v2 JSON with type first', () => {
    const plugin: Mapping = {
      version: 2,
      canvas: { width: 1920, height: 1080 },
      grid: { size: 10 },
      surfaces: [{ ...surf('a', 0, 0), mask: { type: 'ellipse', x: 0.5, y: 0.5, width: 0.4, height: 0.2 } }],
      groups: [],
      layers: [{ surface: 'a' }],
    };
    const r = readMapping(JSON.parse(JSON.stringify(plugin)));
    expect(r.kind === 'ok' && canonicalJson(r.mapping)).toBe(canonicalJson(plugin));
  });
});
