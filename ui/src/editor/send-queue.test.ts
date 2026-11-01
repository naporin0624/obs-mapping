import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VendorResult } from '../obs/client';
import type { Mapping } from '../model/mapping';
import { createSendQueue } from './send-queue';

const mapping = (n: number): Mapping => ({ version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: n }, surfaces: [] });

type Deferred = { resolve: (r: VendorResult<{}>) => void; reject: (e: Error) => void };

const harness = () => {
  const calls: { m: Mapping; d: Deferred }[] = [];
  const errors: string[] = [];
  const send = (m: Mapping) =>
    new Promise<VendorResult<{}>>((resolve, reject) => {
      calls.push({ m, d: { resolve, reject } });
    });
  const queue = createSendQueue({ send, onError: (e) => errors.push(e), intervalMs: 33 });
  return { calls, errors, queue };
};

const grids = (calls: { m: Mapping }[]): number[] => calls.map((c) => c.m.grid.size);

describe('send queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends immediately when not dragging', () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: false });
    expect(grids(calls)).toEqual([1]);
  });

  it('throttles to one send per 33 ms while dragging and ends with the latest', async () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: true });
    expect(grids(calls)).toEqual([1]);
    calls[0]?.d.resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);

    queue.push(mapping(2), { dragging: true });
    queue.push(mapping(3), { dragging: true });
    expect(grids(calls)).toEqual([1]);
    await vi.advanceTimersByTimeAsync(33);
    expect(grids(calls)).toEqual([1, 3]);
  });

  it('flush sends the latest pending right away', async () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: true });
    calls[0]?.d.resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    queue.push(mapping(2), { dragging: true });
    expect(grids(calls)).toEqual([1]);
    queue.flush();
    expect(grids(calls)).toEqual([1, 2]);
  });

  it('flush while a send is in flight sends the latest as soon as it completes', async () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: true });
    queue.push(mapping(2), { dragging: true });
    queue.flush();
    expect(grids(calls)).toEqual([1]);
    calls[0]?.d.resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(grids(calls)).toEqual([1, 2]);
  });

  it('coalesces pushes while one request is in flight (one at a time, latest wins)', async () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: false });
    queue.push(mapping(2), { dragging: false });
    queue.push(mapping(3), { dragging: false });
    expect(grids(calls)).toEqual([1]);
    calls[0]?.d.resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(grids(calls)).toEqual([1, 3]);
  });

  it('keeps the latest mapping when the send is rejected and resends it on reconnect', async () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: false });
    calls[0]?.d.reject(new Error('Not connected'));
    await vi.advanceTimersByTimeAsync(0);
    expect(grids(calls)).toEqual([1]);

    queue.push(mapping(2), { dragging: false });
    expect(grids(calls)).toEqual([1]);

    queue.onReconnect();
    expect(grids(calls)).toEqual([1, 2]);
  });

  it('resends the failed mapping on reconnect when nothing newer was pushed', async () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: false });
    calls[0]?.d.reject(new Error('Not connected'));
    await vi.advanceTimersByTimeAsync(0);
    queue.onReconnect();
    expect(grids(calls)).toEqual([1, 1]);
  });

  it('reports ok:false via onError and does not retry', async () => {
    const { calls, errors, queue } = harness();
    queue.push(mapping(1), { dragging: false });
    calls[0]?.d.resolve({ ok: false, error: 'bad mapping' });
    await vi.advanceTimersByTimeAsync(0);
    expect(errors).toEqual(['bad mapping']);
    await vi.advanceTimersByTimeAsync(1000);
    queue.onReconnect();
    expect(grids(calls)).toEqual([1]);
  });

  it('sends nothing after dispose', async () => {
    const { calls, queue } = harness();
    queue.push(mapping(1), { dragging: true });
    calls[0]?.d.resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    queue.push(mapping(2), { dragging: true });
    queue.dispose();
    await vi.advanceTimersByTimeAsync(100);
    expect(grids(calls)).toEqual([1]);
  });
});
