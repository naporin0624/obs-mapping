import { describe, expect, it } from 'vitest';
import { flatLayers } from './layers';
import type { Mapping, Surface } from './mapping';
import { countSurfacesBySource, surfaceCountLabel } from './source-usage';

const surface = (id: string, source: string): Surface => ({
  id,
  name: id,
  type: 'quad',
  source,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  corners: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  visible: true,
});

const mappingOf = (...sources: string[]): Mapping => {
  const surfaces = sources.map((s, i) => surface(String(i), s));
  return { version: 2, canvas: { width: 1920, height: 1080 }, grid: { size: 10 }, surfaces, groups: [], layers: flatLayers(surfaces) };
};

describe('countSurfacesBySource', () => {
  it('counts surfaces per source name', () => {
    const counts = countSurfacesBySource(mappingOf('cam', 'cam', 'bgm'));
    expect(counts.get('cam')).toBe(2);
    expect(counts.get('bgm')).toBe(1);
  });

  it('has no entry for a source nothing uses', () => {
    expect(countSurfacesBySource(mappingOf('cam')).get('other')).toBeUndefined();
  });

  it('ignores unassigned surfaces', () => {
    expect(countSurfacesBySource(mappingOf('', 'cam')).has('')).toBe(false);
  });
});

describe('surfaceCountLabel', () => {
  it('uses a dash for zero', () => {
    expect(surfaceCountLabel(0)).toBe('—');
  });
  it('is singular for one', () => {
    expect(surfaceCountLabel(1)).toBe('1 surface');
  });
  it('is plural for many', () => {
    expect(surfaceCountLabel(3)).toBe('3 surfaces');
  });
});
