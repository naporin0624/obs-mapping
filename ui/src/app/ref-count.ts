/** Starts on the first acquire() and stops with the last release; every acquire() gets its own idempotent release. */
export const createRefCount = (start: () => () => void) => {
  const holders = new Set<object>();
  let stop: (() => void) | null = null;

  const releaseAll = (): void => {
    holders.clear();
    stop?.();
    stop = null;
  };

  const acquire = (): (() => void) => {
    const holder = {};
    holders.add(holder);
    stop ??= start();
    return () => {
      if (holders.delete(holder) && holders.size === 0) releaseAll();
    };
  };

  return { acquire, releaseAll, held: (): boolean => holders.size > 0 };
};
