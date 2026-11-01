import { createRefCount } from '../ref-count';
import type { SourceSession } from './source-session';

const noop = (): void => undefined;

/** Whether resyncs are wanted (reference-counted) and the stop of the one running on the current source session. */
export const createResyncMode = (current: () => SourceSession | null) => {
  let stopSession = noop;

  const detach = (): void => {
    stopSession();
    stopSession = noop;
  };

  const attach = (session: SourceSession | null): void => {
    detach();
    if (wanted.held() && session !== null) stopSession = session.startResync();
  };

  const wanted = createRefCount((): (() => void) => {
    attach(current());
    return detach;
  });

  return { attach, detach, start: wanted.acquire, dispose: wanted.releaseAll };
};
