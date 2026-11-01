export type Emitter<E> = { emit: (e: E) => void; subscribe: (cb: (e: E) => void) => () => void; clear: () => void };

/** Events reach every listener in emission order: one emitted from inside a listener waits until the current event is fully delivered. */
export const createEmitter = <E>(): Emitter<E> => {
  const listeners = new Set<(e: E) => void>();
  let queue: readonly E[] = [];
  let emitting = false;

  const drain = (): void => {
    emitting = true;
    try {
      while (queue.length > 0) {
        const [head, ...rest] = queue;
        queue = rest;
        for (const cb of listeners) cb(head as E);
      }
    } finally {
      emitting = false;
      queue = [];
    }
  };

  return {
    emit: (e) => {
      queue = [...queue, e];
      if (!emitting) drain();
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    clear: () => {
      listeners.clear();
      queue = [];
    },
  };
};
