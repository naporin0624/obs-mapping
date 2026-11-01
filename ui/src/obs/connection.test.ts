import { describe, expect, it } from 'vitest';
import { nextConnState, type ConnState } from './connection';

const idle: ConnState = { kind: 'idle' };

describe('nextConnState', () => {
  it('connect from idle starts attempt 1', () => {
    expect(nextConnState(idle, 'connect')).toEqual({ kind: 'connecting', attempt: 1 });
  });

  it('closed while connecting waits with backoff 500, 1000, 2000, 4000, then capped at 5000', () => {
    const delays: number[] = [];
    let s: ConnState = nextConnState(idle, 'connect');
    for (let i = 0; i < 6; i++) {
      s = nextConnState(s, 'closed');
      if (s.kind !== 'waiting') throw new Error('expected waiting');
      delays.push(s.retryInMs);
      s = nextConnState(s, 'retry');
    }
    expect(delays).toEqual([500, 1000, 2000, 4000, 5000, 5000]);
  });

  it('retry from waiting goes to connecting with attempt+1', () => {
    expect(nextConnState({ kind: 'waiting', attempt: 2, retryInMs: 1000 }, 'retry')).toEqual({ kind: 'connecting', attempt: 3 });
  });

  it('opened resets the attempt counter', () => {
    const s = nextConnState({ kind: 'connecting', attempt: 4 }, 'opened');
    expect(s).toEqual({ kind: 'open' });
    const after = nextConnState(nextConnState(s, 'closed'), 'retry');
    expect(after).toEqual({ kind: 'connecting', attempt: 2 });
    expect(nextConnState(nextConnState(s, 'closed'), 'closed')).toEqual({ kind: 'waiting', attempt: 1, retryInMs: 500 });
  });

  it('auth_error goes to auth_failed and does not retry', () => {
    const s = nextConnState({ kind: 'connecting', attempt: 1 }, 'auth_error');
    expect(s).toEqual({ kind: 'auth_failed' });
    expect(nextConnState(s, 'closed')).toEqual({ kind: 'auth_failed' });
    expect(nextConnState(s, 'retry')).toEqual({ kind: 'auth_failed' });
  });

  it('connect restarts from auth_failed and from waiting', () => {
    expect(nextConnState({ kind: 'auth_failed' }, 'connect')).toEqual({ kind: 'connecting', attempt: 1 });
    expect(nextConnState({ kind: 'waiting', attempt: 3, retryInMs: 2000 }, 'connect')).toEqual({ kind: 'connecting', attempt: 1 });
  });
});
