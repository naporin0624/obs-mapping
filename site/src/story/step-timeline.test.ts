import { describe, expect, it } from 'vitest';

import { createStepTimeline, STEP_DURATION_MS } from './step-timeline';

describe('createStepTimeline', () => {
  it('starts on the given step, finished', () => {
    const timeline = createStepTimeline(3, () => false);
    expect(timeline.at(0)).toEqual({ index: 3, t: 1 });
    expect(timeline.animating()).toBe(false);
  });

  it('animates a selected step from 0 to 1, counting from the first frame after the selection', () => {
    const timeline = createStepTimeline(3, () => false);
    timeline.select(1);
    expect(timeline.at(1000)).toEqual({ index: 1, t: 0 });
    expect(timeline.animating()).toBe(true);
    expect(timeline.at(1000 + STEP_DURATION_MS / 2).t).toBeCloseTo(0.5, 9);
    expect(timeline.at(1000 + STEP_DURATION_MS)).toEqual({ index: 1, t: 1 });
    expect(timeline.animating()).toBe(false);
  });

  it('jumps straight to the end under reduced motion', () => {
    const timeline = createStepTimeline(3, () => true);
    timeline.select(2);
    expect(timeline.at(500)).toEqual({ index: 2, t: 1 });
    expect(timeline.animating()).toBe(false);
  });

  it('takes about 1.2 seconds', () => {
    expect(STEP_DURATION_MS).toBe(1200);
  });
});
