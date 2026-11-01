import { describe, expect, it, vi } from 'vitest';
import type { Mapping } from '../model/mapping';
import { createClient, type ObsSocket } from './client';

const mapping: Mapping = { version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: 10 }, surfaces: [] };

type VendorHandler = (ev: { vendorName: string; eventType: string; eventData: unknown }) => void;

const fakeSocket = () => {
  const call = vi.fn<(type: string, data?: { requestType?: string; requestData?: Record<string, unknown> }) => Promise<unknown>>();
  const handlers = new Set<VendorHandler>();
  const socket = {
    call,
    on: (_event: string, h: VendorHandler): void => {
      handlers.add(h);
    },
    off: (_event: string, h: VendorHandler): void => {
      handlers.delete(h);
    },
  } as unknown as ObsSocket;
  const fire = (ev: Parameters<VendorHandler>[0]): void => handlers.forEach((h) => h(ev));
  const reply = (responseData: unknown): void => {
    call.mockResolvedValueOnce({ responseData });
  };
  return { socket, call, handlers, fire, reply };
};

const vendorEvent = (eventType: string, eventData: unknown, vendorName = 'obs-mapping') => ({ vendorName, eventType, eventData });

describe('obs client', () => {
  it('setMapping sends the mapping as a JSON string', async () => {
    const f = fakeSocket();
    f.reply({ ok: true });
    const r = await createClient(f.socket).setMapping('Map', mapping);
    expect(r).toEqual({ ok: true });
    const data = f.call.mock.calls[0]?.[1];
    expect(data?.requestType).toBe('SetMapping');
    expect(data?.requestData).toEqual({ sourceName: 'Map', mappingJson: JSON.stringify(mapping) });
  });

  it('getMapping parses mappingJson and reads overlayEnabled (false when missing)', async () => {
    const f = fakeSocket();
    const client = createClient(f.socket);
    f.reply({ ok: true, mappingJson: JSON.stringify(mapping), overlayEnabled: true });
    expect(await client.getMapping('Map')).toEqual({ ok: true, mapping, overlayEnabled: true });
    f.reply({ ok: true, mappingJson: JSON.stringify(mapping) });
    expect(await client.getMapping('Map')).toEqual({ ok: true, mapping, overlayEnabled: false });
  });

  it('getMapping reports an unparsable mappingJson', async () => {
    const f = fakeSocket();
    f.reply({ ok: true, mappingJson: '{ nope' });
    const r = await createClient(f.socket).getMapping('Map');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.startsWith('mappingJson: ')).toBe(true);
  });

  it('getMapping passes plugin errors through', async () => {
    const f = fakeSocket();
    f.reply({ ok: false, error: 'source not found: Map' });
    expect(await createClient(f.socket).getMapping('Map')).toEqual({ ok: false, error: 'source not found: Map' });
  });

  it('setOverlay sends selectionJson, and enabled only when given', async () => {
    const f = fakeSocket();
    const client = createClient(f.socket);
    const selection = { selectedSurfaceIds: ['a'], selectedCorner: { surfaceId: 'a', index: 2 } };
    f.reply({ ok: true });
    await client.setOverlay('Map', selection);
    f.reply({ ok: true });
    await client.setOverlay('Map', { ...selection, enabled: true });
    const first = f.call.mock.calls[0]?.[1]?.requestData ?? {};
    const second = f.call.mock.calls[1]?.[1]?.requestData ?? {};
    expect('enabled' in first).toBe(false);
    expect(JSON.parse(String(first['selectionJson']))).toEqual(selection);
    expect(second['enabled']).toBe(true);
  });

  it('marks socket failures as transport errors but not plugin refusals', async () => {
    const f = fakeSocket();
    const client = createClient(f.socket);
    f.call.mockRejectedValueOnce(new Error('Not connected'));
    expect(await client.setMapping('Map', mapping)).toEqual({ ok: false, error: 'Not connected', transport: true });
    f.reply({ ok: false, error: 'version: unsupported' });
    expect(await client.setMapping('Map', mapping)).toEqual({ ok: false, error: 'version: unsupported' });
    f.call.mockResolvedValueOnce({});
    expect(await client.setMapping('Map', mapping)).toEqual({ ok: false, error: 'empty response' });
  });

  it('onMappingChanged filters by vendor and event type and reads overlayEnabled', () => {
    const f = fakeSocket();
    const cb = vi.fn();
    const off = createClient(f.socket).onMappingChanged(cb);
    const data = { sourceName: 'Map', mappingJson: JSON.stringify(mapping), overlayEnabled: true };
    f.fire(vendorEvent('MappingChanged', data, 'other-vendor'));
    f.fire(vendorEvent('OverlayChanged', data));
    f.fire(vendorEvent('MappingChanged', null));
    f.fire(vendorEvent('MappingChanged', 'text'));
    f.fire(vendorEvent('MappingChanged', { ...data, mappingJson: '{ nope' }));
    f.fire(vendorEvent('MappingChanged', { mappingJson: JSON.stringify(mapping) }));
    expect(cb).not.toHaveBeenCalled();
    f.fire(vendorEvent('MappingChanged', data));
    f.fire(vendorEvent('MappingChanged', { sourceName: 'Map', mappingJson: JSON.stringify(mapping) }));
    expect(cb.mock.calls).toEqual([
      ['Map', mapping, true],
      ['Map', mapping, undefined],
    ]);
    off();
    expect(f.handlers.size).toBe(0);
  });

  it('onOverlayChanged only accepts well-formed OverlayChanged events', () => {
    const f = fakeSocket();
    const cb = vi.fn();
    const off = createClient(f.socket).onOverlayChanged(cb);
    f.fire(vendorEvent('OverlayChanged', { sourceName: 'Map', enabled: true }, 'other-vendor'));
    f.fire(vendorEvent('MappingChanged', { sourceName: 'Map', enabled: true }));
    f.fire(vendorEvent('OverlayChanged', { sourceName: 'Map', enabled: 'yes' }));
    f.fire(vendorEvent('OverlayChanged', { enabled: true }));
    f.fire(vendorEvent('OverlayChanged', undefined));
    expect(cb).not.toHaveBeenCalled();
    f.fire(vendorEvent('OverlayChanged', { sourceName: 'Map', enabled: false }));
    expect(cb).toHaveBeenCalledExactlyOnceWith('Map', false);
    off();
    expect(f.handlers.size).toBe(0);
  });
});
