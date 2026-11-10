import { describe, expect, it, vi } from 'vitest';
import { mapOf, surf } from '../geometry/fixtures';
import type { Mapping } from '../model/mapping';
import { createClient, type ObsSocket } from './client';

const mapping: Mapping = mapOf();

type VendorHandler = (ev: { vendorName: string; eventType: string; eventData: unknown }) => void;

const fakeSocket = () => {
  const call = vi.fn<(type: string, data?: { requestType?: string; requestData?: Record<string, unknown> }) => Promise<unknown>>();
  const handlers = new Map<string, Set<(data: unknown) => void>>();
  const socket = {
    call,
    on: (event: string, h: (data: unknown) => void): void => {
      handlers.set(event, (handlers.get(event) ?? new Set()).add(h));
    },
    off: (event: string, h: (data: unknown) => void): void => {
      handlers.get(event)?.delete(h);
    },
  } as unknown as ObsSocket;
  const emit = (event: string, data: unknown): void => {
    for (const h of handlers.get(event) ?? []) h(data);
  };
  const fire = (ev: Parameters<VendorHandler>[0]): void => emit('VendorEvent', ev);
  const listenerCount = (): number => [...handlers.values()].reduce((n, set) => n + set.size, 0);
  const reply = (responseData: unknown): void => {
    call.mockResolvedValueOnce({ responseData });
  };
  return { socket, call, emit, fire, listenerCount, reply };
};

const vendorEvent = (eventType: string, eventData: unknown, vendorName = 'surface-mapper') => ({ vendorName, eventType, eventData });

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

  it('setMapping passes requestId through when given', async () => {
    const f = fakeSocket();
    f.reply({ ok: true });
    await createClient(f.socket).setMapping('Map', mapping, 'n1-3');
    expect(f.call.mock.calls[0]?.[1]?.requestData).toEqual({ sourceName: 'Map', mappingJson: JSON.stringify(mapping), requestId: 'n1-3' });
  });

  it('getMapping parses mappingJson and reads overlayEnabled (false when missing)', async () => {
    const f = fakeSocket();
    const client = createClient(f.socket);
    f.reply({ ok: true, mappingJson: JSON.stringify(mapping), overlayEnabled: true });
    expect(await client.getMapping('Map')).toEqual({ ok: true, mapping, overlayEnabled: true });
    f.reply({ ok: true, mappingJson: JSON.stringify(mapping) });
    expect(await client.getMapping('Map')).toEqual({ ok: true, mapping, overlayEnabled: false });
  });

  it('getMapping reads a v1 mappingJson as a v2 mapping', async () => {
    const f = fakeSocket();
    const { groups: _g, layers: _l, ...rest } = mapOf(surf('a', 0, 0));
    f.reply({ ok: true, mappingJson: JSON.stringify({ ...rest, version: 1 }), overlayEnabled: false });
    const r = await createClient(f.socket).getMapping('Map');
    expect(r.ok && r.mapping).toEqual(mapOf(surf('a', 0, 0)));
  });

  it('getMapping reports an invalid tree', async () => {
    const f = fakeSocket();
    f.reply({ ok: true, mappingJson: JSON.stringify({ ...mapOf(surf('a', 0, 0)), layers: [] }) });
    expect(await createClient(f.socket).getMapping('Map')).toEqual({ ok: false, error: 'mappingJson: layers: surface "a" is missing from the tree' });
  });

  it('onMappingChanged reads a v1 payload as v2 and keeps the requestId', () => {
    const f = fakeSocket();
    const cb = vi.fn();
    createClient(f.socket).onMappingChanged(cb);
    const { groups: _g, layers: _l, ...rest } = mapOf(surf('a', 0, 0));
    f.fire(vendorEvent('MappingChanged', { sourceName: 'Map', mappingJson: JSON.stringify({ ...rest, version: 1 }), requestId: 'n1-4' }));
    expect(cb.mock.calls).toEqual([['Map', mapOf(surf('a', 0, 0)), undefined, 'n1-4']]);
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
    f.fire(vendorEvent('MappingChanged', { ...data, requestId: 'n1-3' }));
    f.fire(vendorEvent('MappingChanged', { ...data, requestId: 7 }));
    expect(cb.mock.calls).toEqual([
      ['Map', mapping, true, null],
      ['Map', mapping, undefined, null],
      ['Map', mapping, true, 'n1-3'],
      ['Map', mapping, true, null],
    ]);
    off();
    expect(f.listenerCount()).toBe(0);
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
    expect(f.listenerCount()).toBe(0);
  });

  it.each([
    ['InputCreated', { inputName: 'Spout2 Capture', inputUuid: 'u1', inputKind: 'spout_capture' }],
    ['InputRemoved', { inputName: 'Camera', inputUuid: 'u2' }],
    ['InputNameChanged', { inputUuid: 'u3', oldInputName: 'Cam', inputName: 'Camera' }],
    ['CurrentSceneCollectionChanged', { sceneCollectionName: 'surface-mapper' }],
  ])('onInventoryChanged fires on %s', (event, data) => {
    const f = fakeSocket();
    const cb = vi.fn();
    createClient(f.socket).onInventoryChanged(cb);
    f.emit(event, data);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('onInventoryChanged ignores other events and stops after unsubscribe', () => {
    const f = fakeSocket();
    const cb = vi.fn();
    const off = createClient(f.socket).onInventoryChanged(cb);
    f.emit('InputSettingsChanged', { inputName: 'Camera', inputUuid: 'u1', inputSettings: {} });
    expect(cb).not.toHaveBeenCalled();
    off();
    f.emit('InputCreated', { inputName: 'Camera', inputUuid: 'u1', inputKind: 'dshow_input' });
    expect(cb).not.toHaveBeenCalled();
    expect(f.listenerCount()).toBe(0);
  });
});
