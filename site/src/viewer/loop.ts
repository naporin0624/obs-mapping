export type FrameScheduler = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
};

export type Loop = { invalidate: () => void; setOpen: (open: boolean) => void };

// Books a frame only when one was asked for and the gate is open; draw returns true to ask for the next.
export const createLoop = (frames: FrameScheduler, draw: (timeMs: number) => boolean, onDrawError: (error: unknown) => void): Loop => {
  let pending: number | null = null;
  let wanted = true;
  let open = false;
  const run = (timeMs: number): void => {
    pending = null;
    wanted = false;
    try {
      wanted = draw(timeMs) || wanted;
    } catch (error) {
      onDrawError(error);
      return;
    }
    book();
  };
  const book = (): void => {
    if (pending === null && open && wanted) pending = frames.requestFrame(run);
  };
  return {
    invalidate() {
      wanted = true;
      book();
    },
    setOpen(next) {
      open = next;
      if (!open && pending !== null) frames.cancelFrame(pending);
      if (!open) pending = null;
      book();
    },
  };
};
