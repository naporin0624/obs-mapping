import { createStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import { fakeObs, mapping } from '../test/fake-obs';

vi.mock('../obs/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../obs/client')>();
  return { ...original, createObsConnection: vi.fn(() => fakeObs(mapping(10)).connection) };
});

describe('instancesAtom', () => {
  it('constructs nothing on import, one instance per store on first read', async () => {
    const { createObsConnection } = await import('../obs/client');
    const { instancesAtom } = await import('./instances');
    expect(createObsConnection).not.toHaveBeenCalled();
    const first = createStore();
    expect(first.get(instancesAtom)).toBe(first.get(instancesAtom));
    expect(createObsConnection).toHaveBeenCalledTimes(1);
    createStore().get(instancesAtom);
    expect(createObsConnection).toHaveBeenCalledTimes(2);
  });
});
