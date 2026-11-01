import type { Mapping } from '../model/mapping';
import type { VendorResult } from '../obs/client';

export type SendQueueOptions = {
  /** Rejects when the connection is down; resolves with ok:false when the plugin refused the mapping. */
  send: (m: Mapping) => Promise<VendorResult<{}>>;
  onError?: (message: string) => void;
  intervalMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type SendQueue = {
  enqueue(m: Mapping, opts: { dragging: boolean }): void;
  /** Send the latest pending mapping now (end of a drag). */
  flush(): void;
  /** The connection came back: resend whatever could not be delivered. */
  onReconnect(): void;
  /** Drop everything not yet answered (pending, timer, an unanswered request's retry); used before a direct write. */
  discard(): void;
  dispose(): void;
};

const DEFAULT_INTERVAL_MS = 33;

type Outcome = { kind: 'ok' } | { kind: 'offline' } | { kind: 'refused'; error: string };

class Queue implements SendQueue {
  readonly #send: SendQueueOptions['send'];
  readonly #onError: (message: string) => void;
  readonly #intervalMs: number;
  readonly #now: () => number;
  readonly #setTimer: (fn: () => void, ms: number) => unknown;
  readonly #clearTimer: (handle: unknown) => void;
  #pending: Mapping | null = null;
  /** The mapping of the request currently awaiting an answer. */
  #current: Mapping | null = null;
  /** Bumped when a request is abandoned (reconnect), so its late answer is ignored. */
  #generation = 0;
  #inFlight = false;
  #dragging = false;
  #disconnected = false;
  #disposed = false;
  #lastSendAt = Number.NEGATIVE_INFINITY;
  #timer: unknown = null;

  constructor(o: SendQueueOptions) {
    this.#send = o.send;
    this.#onError = o.onError ?? ((): void => undefined);
    this.#intervalMs = o.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.#now = o.now ?? ((): number => Date.now());
    this.#setTimer = o.setTimer ?? ((fn, ms): unknown => setTimeout(fn, ms));
    this.#clearTimer = o.clearTimer ?? ((h): void => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  enqueue(m: Mapping, opts: { dragging: boolean }): void {
    this.#pending = m;
    this.#dragging = opts.dragging;
    this.#attempt();
  }

  flush(): void {
    this.#dragging = false;
    this.#attempt();
  }

  onReconnect(): void {
    this.#disconnected = false;
    if (this.#inFlight) {
      // The socket dropped under an unanswered request that will never settle: abandon it and resend.
      this.#generation = this.#generation + 1;
      this.#inFlight = false;
      this.#pending ??= this.#current;
      this.#current = null;
    }
    this.#attempt();
  }

  discard(): void {
    this.#pending = null;
    this.#cancelTimer();
    if (this.#inFlight) {
      this.#generation = this.#generation + 1; // its late answer must neither retry nor report
      this.#inFlight = false;
      this.#current = null;
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#cancelTimer();
  }

  #cancelTimer(): void {
    if (this.#timer !== null) this.#clearTimer(this.#timer);
    this.#timer = null;
  }

  #attempt(): void {
    const m = this.#pending;
    if (this.#disposed || this.#inFlight || this.#disconnected || m === null) return;
    const wait = this.#dragging ? this.#lastSendAt + this.#intervalMs - this.#now() : 0;
    if (wait > 0) {
      this.#timer ??= this.#setTimer(() => {
        this.#timer = null;
        this.#attempt();
      }, wait);
      return;
    }
    this.#cancelTimer();
    void this.#deliver(m);
  }

  async #request(m: Mapping): Promise<Outcome> {
    try {
      const r = await this.#send(m);
      if (r.ok) return { kind: 'ok' };
      return r.transport === true ? { kind: 'offline' } : { kind: 'refused', error: r.error };
    } catch {
      return { kind: 'offline' };
    }
  }

  async #deliver(m: Mapping): Promise<void> {
    const generation = this.#generation;
    this.#pending = null;
    this.#current = m;
    this.#inFlight = true;
    this.#lastSendAt = this.#now();
    const outcome = await this.#request(m);
    if (generation !== this.#generation) return; // abandoned by onReconnect(); its late answer is stale
    if (outcome.kind === 'offline') {
      this.#disconnected = true;
      this.#pending ??= m;
    }
    if (outcome.kind === 'refused') this.#onError(outcome.error);
    this.#inFlight = false;
    this.#current = null;
    this.#attempt();
  }
}

/**
 * One request in flight at a time, latest mapping wins, at most one send per interval while dragging.
 * A rejected send keeps the mapping pending until onReconnect(); ok:false is reported and not retried.
 */
export const createSendQueue = (options: SendQueueOptions): SendQueue => new Queue(options);
