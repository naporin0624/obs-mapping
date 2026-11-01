/** StrictMode-safe teardown: terminate() defers dispose to a microtask, cancelTerminate() revokes it. */
export const createTerminator = (dispose: () => void): { terminate: () => void; cancelTerminate: () => boolean } => {
  let pending = false;
  return {
    terminate: () => {
      pending = true;
      queueMicrotask(() => {
        if (!pending) return;
        pending = false;
        dispose();
      });
    },
    cancelTerminate: () => {
      const was = pending;
      pending = false;
      return was;
    },
  };
};
