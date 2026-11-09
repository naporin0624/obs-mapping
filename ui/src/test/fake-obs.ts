import { vi } from 'vitest';
import { mapOf } from '../geometry/fixtures';
import type { Mapping } from '../model/mapping';
import type { MappingChangedHandler, ObsClient, ObsConnection, VendorResult } from '../obs/client';

export const mapping = (grid: number): Mapping => ({ ...mapOf(), grid: { size: grid } });

const listenerSlot = <F>() => {
  let current: F | null = null;
  return {
    listen: (cb: F): (() => void) => {
      current = cb;
      return () => {
        current = null;
      };
    },
    get: (): F | null => current,
  };
};

export const fakeObs = (initial: Mapping) => {
  const plugin = { mapping: initial };
  const close = listenerSlot<(code: number) => void>();
  const mappingChanged = listenerSlot<MappingChangedHandler>();
  const inventory = listenerSlot<() => void>();
  const listInputs = vi.fn(async (): Promise<string[]> => []);
  const listMappingSources = vi.fn(async () => ({ ok: true, sources: [{ name: 'Map', width: 1920, height: 1080 }] }) as VendorResult<{ sources: { name: string; width: number; height: number }[] }>);
  const setMapping = vi.fn(async (_n: string, m: Mapping, requestId?: string) => {
    plugin.mapping = m;
    mappingChanged.get()?.('Map', m, undefined, requestId ?? null);
    return { ok: true } as VendorResult<{}>;
  });
  const getMapping = vi.fn(async (_name: string) => ({ ok: true, mapping: plugin.mapping, overlayEnabled: false }) as VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>);
  const client: ObsClient = {
    listMappingSources,
    getMapping,
    setMapping,
    setOverlay: vi.fn(async () => ({ ok: true }) as VendorResult<{}>),
    screenshot: async () => '',
    listInputs,
    onMappingChanged: mappingChanged.listen,
    onOverlayChanged: () => () => undefined,
    onInventoryChanged: inventory.listen,
  };
  const connection: ObsConnection = { client, connect: async () => undefined, disconnect: async () => undefined, onClose: close.listen };
  return {
    connection,
    client,
    getMapping,
    plugin,
    setMapping,
    listMappingSources,
    listInputs,
    dropSocket: () => close.get()?.(1006),
    changeInventory: () => inventory.get()?.(),
    watchingInventory: () => inventory.get() !== null,
    emit: (m: Mapping, requestId: string | null = null) => mappingChanged.get()?.('Map', m, undefined, requestId),
  };
};

export type FakeObs = ReturnType<typeof fakeObs>;
