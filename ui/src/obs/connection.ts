export type ConnState = { kind: 'idle' } | { kind: 'connecting'; attempt: number } | { kind: 'open' } | { kind: 'waiting'; attempt: number; retryInMs: number } | { kind: 'auth_failed' };

export type ConnEvent = 'connect' | 'opened' | 'closed' | 'auth_error' | 'retry';

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;

const backoffMs = (attempt: number): number => Math.min(BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0), MAX_DELAY_MS);

const waitingAfter = (attempt: number): ConnState => ({ kind: 'waiting', attempt, retryInMs: backoffMs(attempt) });

const onClosed = (s: ConnState): ConnState => {
  switch (s.kind) {
    case 'connecting':
      return waitingAfter(s.attempt);
    case 'open':
      return waitingAfter(1);
    default:
      return s;
  }
};

/** Pure connection state machine. `opened` resets the attempt counter; auth failures never retry. */
export const nextConnState = (s: ConnState, ev: ConnEvent): ConnState => {
  switch (ev) {
    case 'connect':
      return { kind: 'connecting', attempt: 1 };
    case 'opened':
      return s.kind === 'connecting' ? { kind: 'open' } : s;
    case 'closed':
      return onClosed(s);
    case 'auth_error':
      return s.kind === 'connecting' || s.kind === 'open' ? { kind: 'auth_failed' } : s;
    case 'retry':
      return s.kind === 'waiting' ? { kind: 'connecting', attempt: s.attempt + 1 } : s;
  }
};
