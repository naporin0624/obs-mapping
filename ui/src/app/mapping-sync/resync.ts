import type { Mapping } from '../../model/mapping';
import type { ObsClient } from '../../obs/client';
import { createDivergenceResync } from './divergence-resync';
import { createIdleResync } from './idle-resync';
import type { ResyncSnapshot } from './session-state';

export type ResyncDeps = {
  client: ObsClient;
  source: string;
  idleMs: number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  read: () => ResyncSnapshot;
  applyRemote: (mapping: Mapping) => void;
};

type Running = { update: () => void; dispose: () => void };

/** Idle (lost echoes) and divergence (#2) resyncs; inert until start(), which returns an idempotent stop. */
export const createResync = (d: ResyncDeps) => {
  let running: Running | null = null;

  const fetchMapping = async (): Promise<Mapping | null> => {
    const r = await d.client.getMapping(d.source);
    return r.ok ? r.mapping : null;
  };

  const build = (): Running => {
    const idle = createIdleResync({ ...d, fetchMapping });
    const divergence = createDivergenceResync({ read: d.read, fetchMapping, applyRemote: d.applyRemote });
    return {
      update: (): void => {
        idle.update();
        divergence.update();
      },
      dispose: (): void => {
        idle.dispose();
        divergence.dispose();
      },
    };
  };

  const stop = (): void => {
    running?.dispose();
    running = null;
  };

  const start = (): (() => void) => {
    stop();
    const mine = build();
    running = mine;
    mine.update();
    return () => {
      mine.dispose();
      if (running === mine) running = null;
    };
  };

  return { update: (): void => running?.update(), start, dispose: stop };
};
