import { describe, expect, it } from 'vitest';

import { HEX_STROKE, HEX_VIEWBOX, hexCenters, hexOutline } from './hex-thumb';

describe('hexagon thumbnail', () => {
  it('leaves a visible gap of at least one stroke width between neighbouring hexagons', () => {
    const centers = hexCenters();
    const [first] = centers;
    const [v0, v1] = first === undefined ? [] : hexOutline(first);
    if (first === undefined || v0 === undefined || v1 === undefined) throw new Error('no hexagon');
    // Flat-top hexagons of one size: the edge gap is the centre distance minus two apothems.
    const apothem = Math.hypot((v0[0] + v1[0]) / 2 - first.cx, (v0[1] + v1[1]) / 2 - first.cy);
    const nearest = Math.min(...centers.flatMap((a, i) => centers.slice(i + 1).map((b) => Math.hypot(a.cx - b.cx, a.cy - b.cy))));
    expect(nearest - 2 * apothem - HEX_STROKE).toBeGreaterThanOrEqual(HEX_STROKE);
  });

  it('keeps every stroked outline inside the viewBox', () => {
    for (const [x, y] of hexCenters().flatMap(hexOutline)) {
      expect(x - HEX_STROKE / 2).toBeGreaterThanOrEqual(0);
      expect(y - HEX_STROKE / 2).toBeGreaterThanOrEqual(0);
      expect(x + HEX_STROKE / 2).toBeLessThanOrEqual(HEX_VIEWBOX.width);
      expect(y + HEX_STROKE / 2).toBeLessThanOrEqual(HEX_VIEWBOX.height);
    }
  });
});
