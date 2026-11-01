import { describe, expect, it } from 'vitest';
import type { Mapping } from '../model/mapping';
import { exportMapping } from './export';
import { parseImport, scaleMapping } from './import';

const mapping = (width: number, height: number): Mapping => ({
  version: 1,
  canvas: { width, height },
  grid: { size: 10 },
  surfaces: [
    {
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
    },
  ],
});

const current = { width: 1920, height: 1080 };

describe('parseImport', () => {
  it('returns ok for the same resolution', () => {
    const m = mapping(1920, 1080);
    expect(parseImport(JSON.stringify(m), current)).toEqual({ kind: 'ok', mapping: m });
  });

  it('returns mismatch with the current canvas for a different resolution', () => {
    const m = mapping(1280, 720);
    expect(parseImport(JSON.stringify(m), current)).toEqual({ kind: 'mismatch', mapping: m, current });
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
    expect(parseImport(JSON.stringify({ ...mapping(1920, 1080), version: 2 }), current)).toEqual({ kind: 'error', message: 'version: unsupported version 2' });
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
    expect(text.startsWith('{\n  "version": 1')).toBe(true);
    expect(parseImport(text, current)).toEqual({ kind: 'ok', mapping: m });
  });
});
