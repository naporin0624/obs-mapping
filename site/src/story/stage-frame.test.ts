import { describe, expect, it } from 'vitest';

import type { Mapping } from '../../../ui/src/model/mapping';
import type { StepId } from '../scene/spec';
import { stageFrame } from './stage-frame';

const target: Mapping = {
  version: 2,
  canvas: { width: 1920, height: 1080 },
  grid: { size: 20 },
  surfaces: [
    {
      id: 'a',
      name: 'A',
      type: 'quad',
      source: 'Demo Camera',
      crop: { x: 0.2, y: 0.4, width: 0.5, height: 0.2 },
      corners: [
        [100, 200],
        [500, 200],
        [500, 600],
        [100, 600],
      ],
      visible: true,
      mask: { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 },
    },
    {
      id: 'b',
      name: 'B',
      type: 'quad',
      source: 'Demo Camera',
      crop: { x: 0, y: 0, width: 1, height: 1 },
      corners: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      visible: true,
    },
  ],
  groups: [],
  layers: [{ surface: 'a' }, { surface: 'b' }],
};

const full = [
  [0, 0],
  [1920, 0],
  [1920, 1080],
  [0, 1080],
];
const steps: readonly StepId[] = ['place', 'fit', 'shape', 'done'];

describe('stageFrame', () => {
  it('place: every surface covers the canvas regardless of t', () => {
    for (const t of [0, 0.5, 1]) {
      const f = stageFrame(target, steps, 0, t);
      for (const s of f.mapping.surfaces) {
        expect(s.corners).toEqual(full);
        expect(s.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
      }
      expect(f.maskAmount).toBe(0);
      expect(f.orbit).toBe(0);
    }
  });

  it('fit t=0.5: midway between place and target', () => {
    const f = stageFrame(target, steps, 1, 0.5);
    const a = f.mapping.surfaces[0]!;
    expect(a.corners[0]).toEqual([50, 100]);
    expect(a.corners[2]).toEqual([1210, 840]);
    expect(a.crop).toEqual({ x: 0.1, y: 0.2, width: 0.75, height: 0.6 });
    expect(f.maskAmount).toBe(0);
  });

  it('fit t=1 matches the target', () => {
    const f = stageFrame(target, steps, 1, 1);
    expect(f.mapping.surfaces[0]!.corners).toEqual(target.surfaces[0]!.corners);
    expect(f.mapping.surfaces[0]!.crop).toEqual(target.surfaces[0]!.crop);
  });

  it('shape: target geometry, maskAmount = t', () => {
    const f = stageFrame(target, steps, 2, 0.3);
    expect(f.mapping.surfaces[0]!.corners).toEqual(target.surfaces[0]!.corners);
    expect(f.maskAmount).toBe(0.3);
    expect(f.orbit).toBe(0);
  });

  it('done: maskAmount 1, orbit = t', () => {
    const f = stageFrame(target, steps, 3, 0.7);
    expect(f.maskAmount).toBe(1);
    expect(f.orbit).toBe(0.7);
  });

  it('done without shape step still has maskAmount 1', () => {
    const f = stageFrame(target, ['place', 'fit', 'done'], 2, 0);
    expect(f.maskAmount).toBe(1);
  });

  it('keeps mask as in target and absent when absent; does not mutate', () => {
    const snapshot = structuredClone(target);
    const f = stageFrame(target, steps, 1, 0.5);
    expect(f.mapping.surfaces[0]!.mask).toEqual(target.surfaces[0]!.mask);
    expect('mask' in f.mapping.surfaces[1]!).toBe(false);
    expect(target).toEqual(snapshot);
  });

  it('clamps index and t', () => {
    expect(stageFrame(target, steps, 99, 5).orbit).toBe(1);
    expect(stageFrame(target, steps, -3, -1).maskAmount).toBe(0);
    expect(stageFrame(target, steps, 1, 2).mapping.surfaces[0]!.corners).toEqual(target.surfaces[0]!.corners);
  });
});
