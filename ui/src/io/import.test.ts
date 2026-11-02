import { describe, expect, it } from 'vitest';
import { mapOf } from '../geometry/fixtures';
import type { Mapping, MappingV1, Surface } from '../model/mapping';
import { validateTree } from '../model/validate-tree';
import { exportMapping } from './export';
import { parseImport, scaleMapping } from './import';

const surfaceOf = (width: number, height: number): Surface => ({
  id: 's1',
  name: 'A',
  type: 'quad',
  source: 'cam',
  crop: { x: 0, y: 0, width: 1, height: 1 },
  corners: [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ],
  visible: true,
});

const mapping = (width: number, height: number): Mapping => ({ ...mapOf(surfaceOf(width, height)), canvas: { width, height } });

const mappingV1 = (width: number, height: number): MappingV1 => ({ version: 1, canvas: { width, height }, grid: { size: 10 }, surfaces: [surfaceOf(width, height)] });

const current = { width: 1920, height: 1080 };

describe('parseImport', () => {
  it('returns an error for malformed fields without throwing', () => {
    const text = JSON.stringify({ ...mapping(1920, 1080), grid: null });
    expect(parseImport(text, current).kind).toBe('error');
    expect(parseImport(JSON.stringify({ ...mapping(1920, 1080), surfaces: [null] }), current).kind).toBe('error');
  });

  it('returns ok for the same resolution', () => {
    const m = mapping(1920, 1080);
    expect(parseImport(JSON.stringify(m), current)).toEqual({ kind: 'ok', mapping: m });
  });

  it('returns mismatch with the current canvas for a different resolution', () => {
    const m = mapping(1280, 720);
    expect(parseImport(JSON.stringify(m), current)).toEqual({ kind: 'mismatch', mapping: m, current });
  });

  it('reads a v1 file as a v2 mapping', () => {
    const r = parseImport(JSON.stringify(mappingV1(1920, 1080)), current);
    expect(r).toEqual({ kind: 'ok', mapping: mapping(1920, 1080) });
  });

  it('rejects a v2 file whose surfaces do not follow the layers order', () => {
    const m = { ...mapOf({ ...surfaceOf(10, 10), id: 'a' }, { ...surfaceOf(10, 10), id: 'b' }) };
    const r = parseImport(JSON.stringify({ ...m, layers: [...m.layers].reverse() }), current);
    expect(r).toEqual({ kind: 'error', message: 'surfaces: order must match the depth-first order of layers' });
  });

  it('reports broken JSON with a json: prefix', () => {
    const r = parseImport('{oops', current);
    expect(r.kind).toBe('error');
    expect(r.kind === 'error' && r.message.startsWith('json:')).toBe(true);
  });

  it('rejects non-object JSON', () => {
    expect(parseImport('[]', current)).toEqual({ kind: 'error', message: 'json: expected an object' });
  });

  it('rejects a missing or unsupported version', () => {
    const { version: _v, ...noVersion } = mapping(1920, 1080);
    expect(parseImport(JSON.stringify(noVersion), current)).toEqual({ kind: 'error', message: 'version: missing' });
    expect(parseImport(JSON.stringify({ ...mapping(1920, 1080), version: 3 }), current)).toEqual({ kind: 'error', message: 'version: unsupported version 3' });
  });

  it('rejects a bad canvas and non-array surfaces', () => {
    const bad = parseImport(JSON.stringify({ ...mapping(1920, 1080), canvas: { width: 0, height: 10 } }), current);
    expect(bad.kind === 'error' && bad.message.startsWith('canvas.width:')).toBe(true);
    const surfaces = parseImport(JSON.stringify({ ...mapping(1920, 1080), surfaces: {} }), current);
    expect(surfaces.kind === 'error' && surfaces.message.startsWith('surfaces:')).toBe(true);
  });
});

describe('scaleMapping', () => {
  it('scales corners and swaps the canvas, keeping grid and crop', () => {
    const m = mapping(1920, 1080);
    const s = scaleMapping(m, 1280, 720);
    expect(s.canvas).toEqual({ width: 1280, height: 720 });
    expect(s.surfaces[0]?.corners[2]).toEqual([1280, 720]);
    expect(s.grid).toEqual(m.grid);
    expect(s.surfaces[0]?.crop).toEqual(m.surfaces[0]?.crop);
  });
});

describe('exportMapping', () => {
  it('indents with 2 spaces and round-trips through parseImport', () => {
    const m = mapping(1920, 1080);
    const text = exportMapping(m);
    expect(text.startsWith('{\n  "version": 2')).toBe(true);
    expect(parseImport(text, current)).toEqual({ kind: 'ok', mapping: m });
  });
});

describe('scaleMapping groups', () => {
  it('scales origin per axis, gap by the main axis and padding by the smaller ratio', () => {
    const base = mapOf({ ...surfaceOf(100, 100), id: 'a' }, { ...surfaceOf(100, 100), id: 'b' });
    const m: Mapping = {
      ...base,
      groups: [{ id: 'g', name: 'g', visible: true, origin: [100, 100], layout: { direction: 'row', gap: 20, align: 'start', padding: 10 } }],
      layers: [{ group: 'g', children: [{ surface: 'a' }, { surface: 'b' }] }],
    };
    const out = scaleMapping(m, 960, 1080);
    const g = out.groups[0];
    expect(g?.origin).toEqual([50, 100]);
    expect(g?.layout).toMatchObject({ gap: 10, padding: 5 });
    expect(out.surfaces[0]?.corners[0]).toEqual([55, 105]);
  });
  it('uses the vertical ratio for a column gap', () => {
    const m: Mapping = {
      ...mapping(1920, 1080),
      groups: [{ id: 'g', name: 'g', visible: true, origin: [0, 0], layout: { direction: 'column', gap: 20, align: 'start', padding: 0 } }],
      layers: [{ group: 'g', children: [{ surface: 's1' }] }],
    };
    expect(scaleMapping(m, 1920, 540).groups[0]?.layout.gap).toBe(10);
  });

  it('keeps a nested and a hidden group valid', () => {
    const base = mapOf({ ...surfaceOf(100, 100), id: 'a' }, { ...surfaceOf(100, 100), id: 'b' }, { ...surfaceOf(100, 100), id: 'c' });
    const layout = { direction: 'column', gap: 20, align: 'start', padding: 10 } as const;
    const m: Mapping = {
      ...base,
      groups: [
        { id: 'g', name: 'g', visible: true, origin: [100, 100], layout },
        { id: 'h', name: 'h', visible: true, origin: [100, 100], layout },
        { id: 'i', name: 'i', visible: false, origin: [300, 300], layout },
      ],
      layers: [
        { group: 'g', children: [{ surface: 'a' }, { group: 'h', children: [{ surface: 'b' }] }] },
        { group: 'i', children: [{ surface: 'c' }] },
      ],
    };
    const out = scaleMapping(m, 960, 540);
    expect(validateTree(out)).toBeNull();
    expect(out.groups.find((g) => g.id === 'i')).toMatchObject({ origin: [150, 150], layout: { gap: 10, padding: 5 } });
    expect(out.groups.find((g) => g.id === 'h')?.layout).toMatchObject({ gap: 10, padding: 5 });
  });
});

describe('scaleMapping spacing limit', () => {
  it('clamps the scaled gap and padding to the plugin limit', () => {
    const base = mapOf({ ...surfaceOf(100, 100), id: 'a' }, { ...surfaceOf(100, 100), id: 'b' });
    const m: Mapping = {
      ...base,
      groups: [{ id: 'g', name: 'g', visible: true, origin: [0, 0], layout: { direction: 'row', gap: 2000, align: 'start', padding: 2000 } }],
      layers: [{ group: 'g', children: [{ surface: 'a' }, { surface: 'b' }] }],
    };
    const out = scaleMapping(m, 7680, 4320);
    expect(out.groups[0]?.layout).toMatchObject({ gap: 4096, padding: 4096 });
  });
});
