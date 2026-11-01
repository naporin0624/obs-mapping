import type { Mapping } from '../../model/mapping';
import type { SourceSession } from './source-session';

/** Closed sessions that still hold an unsent edit for their own source. */
export const createDrainSet = () => {
  const sessions = new Set<SourceSession>();

  const takeOver = (source: string): Mapping | null => {
    const old = [...sessions].find((s) => s.source === source);
    if (old === undefined) return null;
    sessions.delete(old);
    return old.handOver();
  };

  const abandonAll = (): void => {
    for (const s of sessions) s.abandon();
    sessions.clear();
  };

  return {
    add: (s: SourceSession): void => void sessions.add(s),
    remove: (s: SourceSession): void => void sessions.delete(s),
    each: (fn: (s: SourceSession) => void): void => sessions.forEach(fn),
    takeOver,
    abandonAll,
  };
};
