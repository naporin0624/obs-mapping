import { describe, expect, it } from 'vitest';
import { maskContains } from '../../../ui/src/geometry/mask';
import { MASK_MAX_POINTS } from '../../../ui/src/model/mapping';
import { holeMask, roundHole, squareHole } from './hole-mask';

describe('holeMask', () => {
  it('walks the unit square from the hole height, then the hole, joined by horizontal bridges', () => {
    const mask = holeMask(squareHole(0.5, 0.4, 0.2));
    expect(mask.type).toBe('polygon');
    expect(mask.points.slice(0, 7)).toEqual([
      [0, 0.4],
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0.4],
      [0.3, 0.4],
    ]);
    expect(mask.points.at(-1)).toEqual([0.3, 0.4]);
  });

  it.each([
    ['square', squareHole(0.5, 0.5, 0.2)],
    ['round', roundHole(0.5, 0.5, 0.2)],
  ])('starts the %s hole at its leftmost point on the centre line', (_name, hole) => {
    expect(hole[0]).toEqual([0.3, 0.5]);
  });

  it.each([
    ['square', squareHole(0.5, 0.5, 0.2)],
    ['round', roundHole(0.5, 0.5, 0.2)],
  ])('lights the face but not the %s hole, even-odd', (_name, hole) => {
    const mask = holeMask(hole);
    expect(mask.points.length).toBeLessThanOrEqual(MASK_MAX_POINTS);
    expect(maskContains(mask, [0.5, 0.5])).toBe(false);
    expect(maskContains(mask, [0.62, 0.5])).toBe(false);
    for (const p of [
      [0.5, 0.27],
      [0.73, 0.5],
      [0.02, 0.02],
      [0.1, 0.5],
      [0.2, 0.5],
      [0.98, 0.5],
      [0.5, 0.98],
    ] as const)
      expect(maskContains(mask, p)).toBe(true);
  });

  it('rounds hole points to 4 decimals so mapping.json stays readable', () => {
    for (const [x, y] of roundHole(0.5, 0.5, 0.2)) {
      expect(x).toBe(Math.round(x * 1e4) / 1e4);
      expect(y).toBe(Math.round(y * 1e4) / 1e4);
    }
  });
});
