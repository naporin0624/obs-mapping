import { vi } from 'vitest';
import type { Mapping } from '../model/mapping';
import type { ObsClient, ObsConnection, VendorResult } from '../obs/client';

export const mapping = (grid: number): Mapping => ({ version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: grid }, surfaces: [] });

export const fakeObs = (initial: Mapping) => {
  const plugin = { mapping: initial };
  let closeCb: ((code: number) => void) | null = null;
  let mappingCb: ((name: string, m: Mapping, overlay: boolean | undefined) => void) | null = null;
  const listMappingSources = vi.fn(async () => ({ ok: true, sources: [{ name: 'Map', width: 1920, height: 1080 }] }) as VendorResult<{ sources: { name: string; width: number; height: number }[] }>);
  const setMapping = vi.fn(async (_n: string, m: Mapping) => {
    plugin.mapping = m;
    return { ok: true } as VendorResult<{}>;
  });
  const getMapping = vi.fn(async (_name: string) => ({ ok: true, mapping: plugin.mapping, overlayEnabled: false }) as VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>);
  const client: ObsClient = {
    listMappingSources,
    getMapping,
    setMapping,
    setOverlay: vi.fn(async () => ({ ok: true }) as VendorResult<{}>),
    screenshot: async () => '',
    listInputs: async () => [],
    onMappingChanged: (cb) => {
      mappingCb = cb;
      return () => {
        mappingCb = null;
      };
    },
    onOverlayChanged: () => () => undefined,
  };
  const connection: ObsConnection = {
    client,
    connect: async () => undefined,
    disconnect: async () => undefined,
    onClose: (cb) => {
      closeCb = cb;
      return () => {
        closeCb = null;
      };
    },
  };
  return { connection, client, getMapping, plugin, setMapping, listMappingSources, dropSocket: () => closeCb?.(1006), emit: (m: Mapping) => mappingCb?.('Map', m, undefined) };
};

export type FakeObs = ReturnType<typeof fakeObs>;
