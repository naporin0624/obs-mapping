import { describe, expect, it } from 'vitest';
import { withCrop } from './crop';

const full = { x: 0, y: 0, width: 1, height: 1 };

describe('withCrop', () => {
  it('shrinks width when x moves right so the crop stays inside 0..1', () => {
    expect(withCrop(full, 'x', 0.25)).toEqual({ x: 0.25, y: 0, width: 0.75, height: 1 });
  });
  it('clamps width to the remaining room and to a positive minimum', () => {
    expect(withCrop({ ...full, x: 0.5, width: 0.5 }, 'width', 2)).toMatchObject({ width: 0.5 });
    expect(withCrop(full, 'height', 0)).toMatchObject({ height: 0.001 });
  });
  it('ignores non-finite input', () => {
    expect(withCrop(full, 'y', Number.NaN)).toBe(full);
  });
});
