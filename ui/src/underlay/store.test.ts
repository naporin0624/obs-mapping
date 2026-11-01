import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdbUnderlayStore } from './store';

afterEach(() => vi.restoreAllMocks());

const image = (text: string, visible = true, opacity = 0.6) => ({ blob: new Blob([text], { type: 'image/png' }), visible, opacity });

describe('IndexedDB underlay store', () => {
  it('round-trips the blob and settings per source', async () => {
    const store = createIdbUnderlayStore(new IDBFactory());
    await store.saveImage('A', image('abc', false, 0.3));
    const loaded = await store.load('A');
    expect(loaded).toMatchObject({ visible: false, opacity: 0.3 });
    expect(await loaded?.blob.text()).toBe('abc');
    expect(await store.load('B')).toBeNull();
  });

  it('removes a source without touching others', async () => {
    const store = createIdbUnderlayStore(new IDBFactory());
    await store.saveImage('A', image('a'));
    await store.saveImage('B', image('b'));
    await store.remove('A');
    expect(await store.load('A')).toBeNull();
    expect(await store.load('B')).not.toBeNull();
  });

  it('rejects when IndexedDB cannot open and retries on the next call', async () => {
    const real = new IDBFactory();
    const open = vi.fn(real.open.bind(real));
    open.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    const store = createIdbUnderlayStore({ open } as unknown as IDBFactory);
    await expect(store.load('A')).rejects.toThrow('blocked');
    expect(await store.load('A')).toBeNull();
  });
});

describe('IndexedDB underlay store settings', () => {
  it('saveSettings changes the settings without writing the blob again', async () => {
    const store = createIdbUnderlayStore(new IDBFactory());
    await store.saveImage('A', image('abc'));
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    await store.saveSettings('A', { visible: false, opacity: 0.2 });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0]?.[0]).not.toBeInstanceOf(Blob);
    expect(await store.load('A')).toMatchObject({ visible: false, opacity: 0.2 });
  });
});

describe('IndexedDB underlay store commit failures', () => {
  const abortAfterEveryWrite = (): void => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
  };

  it('rejects saveImage when the transaction aborts after the request succeeded (quota)', async () => {
    const store = createIdbUnderlayStore(new IDBFactory());
    abortAfterEveryWrite();
    await expect(store.saveImage('A', image('abc'))).rejects.toBeDefined();
  });

  it('rejects saveSettings on a failed commit and keeps the earlier data', async () => {
    const store = createIdbUnderlayStore(new IDBFactory());
    await store.saveImage('A', image('abc', true, 0.6));
    abortAfterEveryWrite();
    await expect(store.saveSettings('A', { visible: false, opacity: 0.1 })).rejects.toBeDefined();
    vi.restoreAllMocks();
    expect(await store.load('A')).toMatchObject({ visible: true, opacity: 0.6 });
  });
});
