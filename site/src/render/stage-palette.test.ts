import { wcagContrast } from 'culori';
import { describe, expect, it } from 'vitest';

import { BACKDROP, PROP_BASE, ROOM_BASE } from './stage-palette';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const contrast = (a: number, b: number): number => wcagContrast(hex(a), hex(b));

describe('stage palette', () => {
  it('steps up from backdrop to room to props', () => {
    expect(contrast(ROOM_BASE, BACKDROP)).toBeGreaterThan(1.1);
    expect(contrast(PROP_BASE, ROOM_BASE)).toBeGreaterThan(1.1);
  });

  it('keeps the backdrop a dim room, not black', () => {
    expect(contrast(BACKDROP, 0x000000)).toBeGreaterThan(1.3);
  });

  it('keeps projected white far brighter than the unlit props', () => {
    expect(contrast(0xffffff, PROP_BASE)).toBeGreaterThanOrEqual(7);
  });

  it('keeps an unlit hole distinct from a lit blue face', () => {
    expect(contrast(0x5aa0ff, PROP_BASE)).toBeGreaterThanOrEqual(3);
  });

  it('keeps the beam and the projector body visible on the backdrop', () => {
    expect(contrast(0xffe9b0, BACKDROP)).toBeGreaterThanOrEqual(3);
    expect(contrast(0xb4bac6, BACKDROP)).toBeGreaterThanOrEqual(3);
  });
});
