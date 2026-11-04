export const STEP_DURATION_MS = 1200;

export type StepTimeline = {
  select(index: number): void;
  at(timeMs: number): { index: number; t: number };
  animating(): boolean;
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// The clock starts on the first frame after a selection, so event and frame timestamps never mix.
export const createStepTimeline = (initial: number, reduced: () => boolean): StepTimeline => {
  let index = initial;
  let start: number | null = null;
  let t = 1;
  return {
    select(next) {
      index = next;
      t = reduced() ? 1 : 0;
      start = null;
    },
    at(timeMs) {
      if (t < 1) {
        start = start ?? timeMs;
        t = clamp01((timeMs - start) / STEP_DURATION_MS);
      }
      return { index, t };
    },
    animating: () => t < 1,
  };
};
