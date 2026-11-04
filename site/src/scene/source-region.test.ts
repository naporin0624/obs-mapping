import { describe, expect, it } from 'vitest';

import { insideRegion, sourceRegion } from './source-region';

describe('sourceRegion', () => {
  it('is the centred region of the 1920x1080 source with the given aspect', () => {
    expect(sourceRegion(1)).toEqual({ x: 7 / 32, y: 0, width: 9 / 16, height: 1 });
  });
});

describe('insideRegion', () => {
  it('maps a rect given in region fractions into source fractions', () => {
    const region = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
    expect(insideRegion(region, { x: 0.5, y: 0.25, width: 0.5, height: 0.5 })).toEqual({ x: 0.35, y: 0.30000000000000004, width: 0.25, height: 0.2 });
  });
});
