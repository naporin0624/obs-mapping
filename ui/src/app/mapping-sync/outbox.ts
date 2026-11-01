import type { Mapping } from '../../model/mapping';
import type { ObsClient } from '../../obs/client';
import { createSendQueue } from '../../editor/send-queue';
import { canonicalJson } from '../../editor/state';
import type { RequestIds } from './request-ids';
import type { SessionState } from './session-state';

export type OutboxDeps = {
  client: ObsClient;
  source: string;
  state: SessionState;
  intervalMs: number;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  nextRequestId: RequestIds;
  onSent: (requestId: string, json: string) => void;
  onSettled: () => void;
  onDrained: () => void;
  fail: (message: string) => void;
};

/** Local edits on their way to the plugin: the send queue plus the newest mapping not yet answered. */
export const createOutbox = (d: OutboxDeps) => {
  const { state } = d;
  let draining = false;

  const finishDrain = (): void => {
    if (!draining) return;
    queue.dispose();
    d.onDrained();
  };

  const send = async (m: Mapping) => {
    // Rejecting (not resolving ok:false) tells the queue the connection is down: keep and resend later.
    if (!state.online()) throw new Error('offline');
    const requestId = d.nextRequestId();
    if (!state.closed()) d.onSent(requestId, canonicalJson(m));
    const r = await d.client.setMapping(d.source, m, requestId);
    // a transport failure can settle before the online flag flips: still keep the edit unsent
    if (!r.ok && (r.transport === true || !state.online())) throw new Error(r.error);
    if (state.unsent() === m) {
      state.setUnsent(null);
      d.onSettled();
      finishDrain();
    }
    return r;
  };

  const queue = createSendQueue({ send, onError: d.fail, intervalMs: d.intervalMs, now: d.now, setTimer: d.setTimer, clearTimer: d.clearTimer });

  const submit = (m: Mapping, dragging: boolean): void => {
    state.setUnsent(m);
    queue.enqueue(m, { dragging });
  };

  const discard = (): Mapping | null => {
    const dropped = state.unsent();
    queue.discard();
    state.setUnsent(null);
    return dropped;
  };

  /** Flush what is pending; true when an unanswered edit keeps the outbox alive until it is delivered. */
  const release = (): boolean => {
    queue.flush();
    draining = state.unsent() !== null;
    if (!draining) queue.dispose();
    return draining;
  };

  return {
    submit,
    flush: (): void => queue.flush(),
    reconnect: (): void => queue.onReconnect(),
    discard,
    release,
    dispose: (): void => queue.dispose(),
  };
};
