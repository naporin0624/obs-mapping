import { describe, expect, it } from 'vitest';
import { checkImportable } from '../mapping/importable';
import { buildMapping } from './build-mapping';
import type { Face, SceneSpec } from './spec';

const face = (id: string, patch: Partial<Face> = {}): Face => ({
  id,
  name: id,
  corners: [
    [-1, 1, 0],
    [1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
  ],
  crop: { x: 0, y: 0, width: 0.5, height: 1 },
  ...patch,
});

const specOf = (faces: readonly Face[]): SceneSpec => ({
  slug: 'stairs',
  projector: { position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fovY: 50 },
  props: [],
  faces,
  steps: ['place', 'fit', 'shape', 'done'],
});

describe('buildMapping', () => {
  it('builds an importable mapping with flat layers and the demo source', () => {
    const mapping = buildMapping(specOf([face('a'), face('b')]));
    expect(checkImportable(mapping)).toBeNull();
    expect(mapping.layers).toEqual([{ surface: 'a' }, { surface: 'b' }]);
    expect(mapping.surfaces.every((s) => s.source === 'Demo Camera')).toBe(true);
    expect(mapping.version).toBe(2);
    expect(mapping.groups).toEqual([]);
    expect(mapping.grid).toEqual({ size: 20 });
    expect(mapping.canvas).toEqual({ width: 1920, height: 1080 });
  });

  it('rounds corners to two decimals', () => {
    const [s] = buildMapping(specOf([face('a')])).surfaces;
    for (const [x, y] of s?.corners ?? []) {
      expect(Math.round(x * 100) / 100).toBe(x);
      expect(Math.round(y * 100) / 100).toBe(y);
    }
  });

  it('omits the mask key when a face has none', () => {
    const [s] = buildMapping(specOf([face('a')])).surfaces;
    expect(s !== undefined && 'mask' in s).toBe(false);
  });

  it('keeps the mask when a face has one', () => {
    const mask = { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 } as const;
    const [s] = buildMapping(specOf([face('a', { mask })])).surfaces;
    expect(s?.mask).toEqual(mask);
  });

  it('keeps x+width <= 1 after rounding the crop', () => {
    const [s] = buildMapping(specOf([face('a', { crop: { x: 2 / 3, y: 0, width: 1 / 3, height: 1 } })])).surfaces;
    expect(s).toBeDefined();
    expect((s?.crop.x ?? 0) + (s?.crop.width ?? 0)).toBeLessThanOrEqual(1);
  });
});
