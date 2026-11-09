import type { Group, Mapping, Surface } from '../model/mapping';
import { validateTree } from '../model/validate-tree';
import type { MappingChangedHandler, ObsClient, ObsConnection, VendorResult } from '../obs/client';

const surface = (id: string, source: string, x: number): Surface => ({
  id,
  name: id,
  type: 'quad',
  source,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  corners: [
    [x, 200],
    [x + 600, 200],
    [x + 600, 700],
    [x, 700],
  ],
  visible: true,
});

const column: Group = { id: 'g1', name: '列', visible: true, origin: [200, 200], layout: { direction: 'row', gap: 200, align: 'start', padding: 0 } };

const sample = (grid: number): Mapping => ({
  version: 2,
  canvas: { width: 1920, height: 1080 },
  grid: { size: grid },
  surfaces: [surface('s1', 'Camera', 200), surface('s2', 'Game', 1000)],
  groups: [column],
  layers: [{ group: 'g1', children: [{ surface: 's1' }, { surface: 's2' }] }],
});

const SOURCES = [
  { name: 'Mapping A', width: 1920, height: 1080 },
  { name: 'Mapping B', width: 1280, height: 720 },
];

const frame = (name: string, width: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((width * 9) / 16);
  const g = canvas.getContext('2d');
  if (g === null) return '';
  g.fillStyle = name === 'Camera' ? '#2563eb' : '#16a34a';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#fff';
  g.font = `${String(canvas.height / 4)}px sans-serif`;
  g.fillText(name, 12, canvas.height / 2);
  return canvas.toDataURL('image/jpeg', 0.7);
};

/** Request log and one-shot failure switches shared by the fake plugin and the debug panel. */
export const createMockLog = (failFirstGet: boolean) => {
  let requests: readonly string[] = [];
  let failGet = failFirstGet;
  let failSet = false;
  let dropHandler: () => void = () => undefined;
  const listeners = new Set<() => void>();
  return {
    note: (line: string): void => {
      requests = [...requests, line];
      queueMicrotask(() => listeners.forEach((l) => l()));
    },
    count: (): number => requests.length,
    recent: (): readonly string[] => requests.slice(-8),
    subscribe: (l: () => void): (() => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    setDrop: (fn: () => void): void => {
      dropHandler = fn;
    },
    drop: (): void => dropHandler(),
    armGet: (): void => {
      failGet = true;
    },
    armSet: (): void => {
      failSet = true;
    },
    takeFailGet: (): boolean => {
      const was = failGet;
      failGet = false;
      return was;
    },
    takeFailSet: (): boolean => {
      const was = failSet;
      failSet = false;
      return was;
    },
  };
};

export type MockLog = ReturnType<typeof createMockLog>;

type Listeners = {
  mapping: Set<MappingChangedHandler>;
  overlay: Set<(name: string, enabled: boolean) => void>;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const createPlugin = (log: MockLog, getDelayMs: number) => {
  const mappings = new Map<string, Mapping>([
    ['Mapping A', sample(10)],
    ['Mapping B', sample(20)],
  ]);
  const overlays = new Map<string, boolean>();
  const listeners: Listeners = { mapping: new Set(), overlay: new Set() };
  const note = log.note;

  const getMapping: ObsClient['getMapping'] = async (name) => {
    note(`GetMapping ${name}`);
    await wait(getDelayMs);
    if (log.takeFailGet()) {
      return { ok: false, error: 'mock: GetMapping failed' };
    }
    return { ok: true, mapping: mappings.get(name) ?? sample(10), overlayEnabled: overlays.get(name) ?? false };
  };

  const setMapping: ObsClient['setMapping'] = async (name, mapping, requestId) => {
    note(`SetMapping ${name} grid=${String(mapping.grid.size)} corner0=${JSON.stringify(mapping.surfaces[0]?.corners[0])}`);
    if (log.takeFailSet()) {
      return { ok: false, error: 'mock: SetMapping refused' };
    }
    const invalid = validateTree(mapping);
    if (invalid !== null) return { ok: false, error: invalid };
    mappings.set(name, mapping);
    setTimeout(() => listeners.mapping.forEach((cb) => cb(name, mapping, overlays.get(name), requestId ?? null)), 20);
    return { ok: true };
  };

  const setOverlay: ObsClient['setOverlay'] = async (name, state) => {
    if (state.enabled === undefined) return { ok: true };
    note(`SetOverlay ${name} enabled=${String(state.enabled)}`);
    overlays.set(name, state.enabled);
    const enabled = state.enabled;
    setTimeout(() => listeners.overlay.forEach((cb) => cb(name, enabled)), 20);
    return { ok: true };
  };

  return { getMapping, setMapping, setOverlay, listeners };
};

/** A browser-only stand-in for OBS plus the plugin: any password connects, SetMapping/SetOverlay echo back as events. */
export const createFakeConnection = (log: MockLog, getDelayMs = 800): ObsConnection => {
  const plugin = createPlugin(log, getDelayMs);
  const client: ObsClient = {
    listMappingSources: async () => ({ ok: true, sources: SOURCES }) as VendorResult<{ sources: typeof SOURCES }>,
    getMapping: plugin.getMapping,
    setMapping: plugin.setMapping,
    setOverlay: plugin.setOverlay,
    screenshot: async (name, width) => frame(name, width),
    listInputs: async () => ['Camera', 'Game', 'Slides'],
    onMappingChanged: (cb) => {
      plugin.listeners.mapping.add(cb);
      return () => plugin.listeners.mapping.delete(cb);
    },
    onOverlayChanged: (cb) => {
      plugin.listeners.overlay.add(cb);
      return () => plugin.listeners.overlay.delete(cb);
    },
    onInventoryChanged: () => () => undefined,
  };
  const onClose: ObsConnection['onClose'] = (cb) => {
    log.setDrop(() => cb(1006));
    return () => log.setDrop(() => undefined);
  };
  return { client, connect: async () => undefined, disconnect: async () => undefined, onClose };
};
