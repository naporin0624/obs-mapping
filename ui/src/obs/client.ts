import OBSWebSocket from 'obs-websocket-js';
import type { Mapping } from '../model/mapping';
import { EMPTY_RESPONSE, UNKNOWN_ERROR } from '../i18n/localize-error';
import { readMapping } from '../model/read';

/** transport: the request never reached the plugin (socket down), so it is safe to resend later. */
export type VendorFailure = { ok: false; error: string; transport?: true };

export type VendorResult<T> = ({ ok: true } & T) | VendorFailure;

export type OverlayState = {
  /** Omit to leave the plugin's current flag alone (selection-only update). */
  enabled?: boolean;
  selectedSurfaceIds: string[];
  selectedCorner: { surfaceId: string; index: number } | null;
};

/** overlayEnabled is undefined when the event did not carry it; requestId is null unless it answers a SetMapping that had one. */
export type MappingChangedHandler = (sourceName: string, mapping: Mapping, overlayEnabled: boolean | undefined, requestId: string | null) => void;

export type MappingSourceInfo = { name: string; width: number; height: number };

export interface ObsClient {
  listMappingSources(): Promise<VendorResult<{ sources: MappingSourceInfo[] }>>;
  getMapping(sourceName: string): Promise<VendorResult<{ mapping: Mapping; overlayEnabled: boolean }>>;
  /** requestId comes back on the resulting MappingChanged so the sender can recognise its own echo. */
  setMapping(sourceName: string, mapping: Mapping, requestId?: string): Promise<VendorResult<{}>>;
  setOverlay(sourceName: string, state: OverlayState): Promise<VendorResult<{}>>;
  screenshot(sourceName: string, width: number): Promise<string>;
  /** Names of OBS inputs that can be assigned to a surface (Mapping sources excluded); [] on failure. */
  listInputs(): Promise<string[]>;
  onMappingChanged(cb: MappingChangedHandler): () => void;
  onOverlayChanged(cb: (sourceName: string, enabled: boolean) => void): () => void;
  /** Fires when the set of OBS inputs (Mapping sources included) may have changed. */
  onInventoryChanged(cb: () => void): () => void;
}

const VENDOR = 'surface-mapper';
const MAPPING_INPUT_KIND = 'surface_mapper_source';
/** obs-websocket close code for AuthenticationFailed */
export const AUTH_FAILED_CODE = 4009;

type Reply = { ok: boolean; error?: string; transport?: true; [key: string]: unknown };

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const parseMapping = (json: unknown): VendorResult<{ mapping: Mapping }> => {
  if (typeof json !== 'string') return { ok: false, error: 'mappingJson: missing' };
  try {
    const read = readMapping(JSON.parse(json));
    return read.kind === 'ok' ? { ok: true, mapping: read.mapping } : { ok: false, error: `mappingJson: ${read.message}` };
  } catch (e) {
    return { ok: false, error: `mappingJson: ${errorMessage(e)}` };
  }
};

type VendorEventPayload = { vendorName: string; eventType: string; eventData: unknown };

const eventData = (ev: VendorEventPayload, eventType: string): Record<string, unknown> | null => {
  if (ev.vendorName !== VENDOR || ev.eventType !== eventType) return null;
  if (typeof ev.eventData !== 'object' || ev.eventData === null) return null;
  return ev.eventData as Record<string, unknown>;
};

const mappingChangedHandler =
  (cb: MappingChangedHandler) =>
  (ev: VendorEventPayload): void => {
    const data = eventData(ev, 'MappingChanged');
    if (data === null) return;
    const parsed = parseMapping(data['mappingJson']);
    const name = data['sourceName'];
    const overlay = data['overlayEnabled'];
    const requestId = data['requestId'];
    if (parsed.ok && typeof name === 'string') cb(name, parsed.mapping, typeof overlay === 'boolean' ? overlay : undefined, typeof requestId === 'string' ? requestId : null);
  };

const overlayChangedHandler =
  (cb: (sourceName: string, enabled: boolean) => void) =>
  (ev: VendorEventPayload): void => {
    const data = eventData(ev, 'OverlayChanged');
    if (data === null) return;
    const name = data['sourceName'];
    const enabled = data['enabled'];
    if (typeof name === 'string' && typeof enabled === 'boolean') cb(name, enabled);
  };

export type ObsConnection = {
  client: ObsClient;
  connect(url: string, password: string): Promise<void>;
  disconnect(): Promise<void>;
  onClose(cb: (code: number) => void): () => void;
};

const listInputNames = async (obs: ObsSocket): Promise<string[]> => {
  try {
    const res = await obs.call('GetInputList');
    return res.inputs.flatMap((i) => (i['inputKind'] === MAPPING_INPUT_KIND || typeof i['inputName'] !== 'string' ? [] : [i['inputName']]));
  } catch (e) {
    console.warn('GetInputList failed', e);
    return [];
  }
};

const subscribeVendor = (obs: ObsSocket, handler: (ev: VendorEventPayload) => void): (() => void) => {
  obs.on('VendorEvent', handler);
  return () => {
    obs.off('VendorEvent', handler);
  };
};

const INVENTORY_EVENTS = ['InputCreated', 'InputRemoved', 'InputNameChanged', 'CurrentSceneCollectionChanged'] as const;

const subscribeInventory = (obs: ObsSocket, cb: () => void): (() => void) => {
  const handler = (): void => cb();
  for (const event of INVENTORY_EVENTS) obs.on(event, handler);
  return () => {
    for (const event of INVENTORY_EVENTS) obs.off(event, handler);
  };
};

/** The slice of OBSWebSocket the client uses (lets tests pass a fake). */
export type ObsSocket = Pick<OBSWebSocket, 'call' | 'on' | 'off'>;

export const createClient = (obs: ObsSocket): ObsClient => {
  const call = async (requestType: string, requestData: Record<string, unknown>): Promise<Reply> => {
    try {
      const res = await obs.call('CallVendorRequest', { vendorName: VENDOR, requestType, requestData: requestData as never });
      const data = res.responseData as unknown as Reply | undefined;
      return data ?? { ok: false, error: EMPTY_RESPONSE };
    } catch (e) {
      return { ok: false, error: errorMessage(e), transport: true };
    }
  };

  const fail = (r: Reply): VendorFailure => (r.transport === true ? { ok: false, error: r.error ?? UNKNOWN_ERROR, transport: true } : { ok: false, error: r.error ?? UNKNOWN_ERROR });

  return {
    async listMappingSources() {
      const r = await call('ListMappingSources', {});
      if (!r.ok) return fail(r);
      return { ok: true, sources: (r['sources'] as MappingSourceInfo[] | undefined) ?? [] };
    },
    async getMapping(sourceName) {
      const r = await call('GetMapping', { sourceName });
      if (!r.ok) return fail(r);
      const parsed = parseMapping(r['mappingJson']);
      return parsed.ok ? { ok: true, mapping: parsed.mapping, overlayEnabled: r['overlayEnabled'] === true } : parsed;
    },
    async setMapping(sourceName, mapping, requestId) {
      const mappingJson = JSON.stringify(mapping);
      const r = await call('SetMapping', requestId === undefined ? { sourceName, mappingJson } : { sourceName, mappingJson, requestId });
      return r.ok ? { ok: true } : fail(r);
    },
    async setOverlay(sourceName, state) {
      const selectionJson = JSON.stringify({ selectedSurfaceIds: state.selectedSurfaceIds, selectedCorner: state.selectedCorner });
      const r = await call('SetOverlay', state.enabled === undefined ? { sourceName, selectionJson } : { sourceName, enabled: state.enabled, selectionJson });
      return r.ok ? { ok: true } : fail(r);
    },
    async screenshot(sourceName, width) {
      const res = await obs.call('GetSourceScreenshot', { sourceName, imageFormat: 'jpg', imageWidth: width, imageCompressionQuality: 70 });
      return res.imageData;
    },
    listInputs: () => listInputNames(obs),
    onMappingChanged: (cb) => subscribeVendor(obs, mappingChangedHandler(cb)),
    onOverlayChanged: (cb) => subscribeVendor(obs, overlayChangedHandler(cb)),
    onInventoryChanged: (cb) => subscribeInventory(obs, cb),
  };
};

export const createObsConnection = (): ObsConnection => {
  const obs = new OBSWebSocket();
  const client = createClient(obs);

  return {
    client,
    async connect(url, password) {
      await obs.connect(url, password === '' ? undefined : password);
    },
    async disconnect() {
      await obs.disconnect();
    },
    onClose(cb) {
      const handler = (e: { code: number }): void => cb(e.code);
      obs.on('ConnectionClosed', handler);
      return () => {
        obs.off('ConnectionClosed', handler);
      };
    },
  };
};
