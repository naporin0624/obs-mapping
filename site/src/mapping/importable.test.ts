import { describe, expect, it } from 'vitest';
import { checkImportable } from './importable';

const surface = (
  crop = { x: 0, y: 0, width: 1, height: 1 },
  corners: unknown = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
) => ({
  id: 's1',
  name: 'S1',
  type: 'quad',
  source: 'Demo Camera',
  crop,
  corners,
  visible: true,
});

const mapping = (over: Record<string, unknown> = {}) => ({
  version: 2,
  canvas: { width: 1920, height: 1080 },
  grid: { size: 20 },
  groups: [],
  layers: [{ surface: 's1' }],
  surfaces: [surface()],
  ...over,
});

describe('checkImportable', () => {
  it('accepts a minimal valid v2 mapping', () => {
    expect(checkImportable(mapping())).toBeNull();
  });

  it('rejects a crop that overflows on x', () => {
    expect(checkImportable(mapping({ surfaces: [surface({ x: 0.5, y: 0, width: 0.5000001, height: 1 })] }))).toContain('x+width');
  });

  it('rejects a crop that overflows on y', () => {
    expect(checkImportable(mapping({ surfaces: [surface({ x: 0, y: 0.5, width: 1, height: 0.6 })] }))).toContain('y+height');
  });

  it('rejects a non-integer canvas width', () => {
    expect(checkImportable(mapping({ canvas: { width: 1920.5, height: 1080 } }))).toContain('canvas.width');
  });

  it('rejects a canvas above 16384', () => {
    expect(checkImportable(mapping({ canvas: { width: 1920, height: 16385 } }))).toContain('canvas.height');
  });

  it('rejects a grid size above 1024', () => {
    expect(checkImportable(mapping({ grid: { size: 2000 } }))).toContain('grid.size');
  });

  it('rejects what readMapping rejects', () => {
    expect(
      checkImportable(
        mapping({
          surfaces: [
            surface(undefined, [
              [0, 0],
              [1, 0],
              [1, 1],
            ]),
          ],
        }),
      ),
    ).not.toBeNull();
  });
});
