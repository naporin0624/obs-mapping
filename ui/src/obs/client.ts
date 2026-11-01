import OBSWebSocket from 'obs-websocket-js';
import type { Mapping } from '../model/mapping';

export type VendorResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export type OverlayState = {
  enabled: boolean;
  selectedSurfaceIds: string[];
  selectedCorner: { surfaceId: string; index: number } | null;
};

export interface ObsClient {
  listMappingSources(): Promise<VendorResult<{ sources: { name: string; width: number; height: number }[] }>>;
  getMapping(sourceName: string): Promise<VendorResult<{ mapping: Mapping }>>;
  setMapping(sourceName: string, mapping: Mapping): Promise<VendorResult<{}>>;
  setOverlay(sourceName: string, state: OverlayState): Promise<VendorResult<{}>>;
  screenshot(sourceName: string, width: number): Promise<string>;
  /** Names of OBS inputs that can be assigned to a surface (Mapping sources excluded); [] on failure. */
  listInputs(): Promise<string[]>;
  onMappingChanged(cb: (sourceName: string, mapping: Mapping) => void): () => void;
}

const VENDOR = 'obs-mapping';
const MAPPING_INPUT_KIND = 'obs_mapping_source';
/** obs-websocket close code for AuthenticationFailed */
export const AUTH_FAILED_CODE = 4009;

type Reply = { ok: boolean; error?: string; [key: string]: unknown };

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const parseMapping = (json: unknown): VendorResult<{ mapping: Mapping }> => {
  if (typeof json !== 'string') return { ok: false, error: 'mappingJson: missing' };
  try {
    return { ok: true, mapping: JSON.parse(json) as Mapping };
  } catch (e) {
    return { ok: false, error: `mappingJson: ${errorMessage(e)}` };
  }
};

type VendorEventPayload = { vendorName: string; eventType: string; eventData: unknown };

const mappingChangedHandler =
  (cb: (sourceName: string, mapping: Mapping) => void) =>
  (ev: VendorEventPayload): void => {
    if (ev.vendorName !== VENDOR || ev.eventType !== 'MappingChanged') return;
    if (typeof ev.eventData !== 'object' || ev.eventData === null) return;
    const data = ev.eventData as { sourceName?: string; mappingJson?: string };
    const parsed = parseMapping(data.mappingJson);
    if (parsed.ok && typeof data.sourceName === 'string') cb(data.sourceName, parsed.mapping);
  };

export type ObsConnection = {
  client: ObsClient;
  connect(url: string, password: string): Promise<void>;
  disconnect(): Promise<void>;
  onClose(cb: (code: number) => void): () => void;
};

const listInputNames = async (obs: OBSWebSocket): Promise<string[]> => {
  try {
    const res = await obs.call('GetInputList');
    return res.inputs.flatMap((i) => (i['inputKind'] === MAPPING_INPUT_KIND || typeof i['inputName'] !== 'string' ? [] : [i['inputName']]));
  } catch (e) {
    console.warn('GetInputList failed', e);
    return [];
  }
};

const createClient = (obs: OBSWebSocket): ObsClient => {
  const call = async (requestType: string, requestData: Record<string, unknown>): Promise<Reply> => {
    try {
      const res = await obs.call('CallVendorRequest', { vendorName: VENDOR, requestType, requestData: requestData as never });
      const data = res.responseData as unknown as Reply | undefined;
      return data ?? { ok: false, error: 'empty response' };
    } catch (e) {
      return { ok: false, error: errorMessage(e) };
    }
  };

  const fail = (r: Reply): { ok: false; error: string } => ({ ok: false, error: r.error ?? 'unknown error' });

  return {
    async listMappingSources() {
      const r = await call('ListMappingSources', {});
      if (!r.ok) return fail(r);
      return { ok: true, sources: (r['sources'] as { name: string; width: number; height: number }[] | undefined) ?? [] };
    },
    async getMapping(sourceName) {
      const r = await call('GetMapping', { sourceName });
      return r.ok ? parseMapping(r['mappingJson']) : fail(r);
    },
    async setMapping(sourceName, mapping) {
      const r = await call('SetMapping', { sourceName, mappingJson: JSON.stringify(mapping) });
      return r.ok ? { ok: true } : fail(r);
    },
    async setOverlay(sourceName, state) {
      const selectionJson = JSON.stringify({ selectedSurfaceIds: state.selectedSurfaceIds, selectedCorner: state.selectedCorner });
      const r = await call('SetOverlay', { sourceName, enabled: state.enabled, selectionJson });
      return r.ok ? { ok: true } : fail(r);
    },
    async screenshot(sourceName, width) {
      const res = await obs.call('GetSourceScreenshot', { sourceName, imageFormat: 'jpg', imageWidth: width, imageCompressionQuality: 70 });
      return res.imageData;
    },
    listInputs: () => listInputNames(obs),
    onMappingChanged(cb) {
      const handler = mappingChangedHandler(cb);
      obs.on('VendorEvent', handler);
      return () => {
        obs.off('VendorEvent', handler);
      };
    },
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
