import type { Mapping } from '../model/mapping';

export type Canvas = Mapping['canvas'];

export type ImportResult = { kind: 'ok'; mapping: Mapping } | { kind: 'mismatch'; mapping: Mapping; current: Canvas } | { kind: 'error'; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

const fail = (message: string): ImportResult => ({ kind: 'error', message });

const checkStructure = (json: Record<string, unknown>): string | null => {
  const { version, canvas, surfaces } = json;
  if (version === undefined) return 'version: missing';
  if (version !== 1) return `version: unsupported version ${JSON.stringify(version)}`;
  if (!isRecord(canvas)) return 'canvas: expected an object';
  if (!isPositive(canvas['width'])) return 'canvas.width: expected a positive number';
  if (!isPositive(canvas['height'])) return 'canvas.height: expected a positive number';
  if (!Array.isArray(surfaces)) return 'surfaces: expected an array';
  return null;
};

/** Structural checks only; the plugin does the full validation when the mapping is sent. */
export const parseImport = (text: string, current: Canvas): ImportResult => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return fail(`json: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isRecord(json)) return fail('json: expected an object');
  const problem = checkStructure(json);
  if (problem !== null) return fail(problem);
  const mapping = json as unknown as Mapping;
  const same = mapping.canvas.width === current.width && mapping.canvas.height === current.height;
  return same ? { kind: 'ok', mapping } : { kind: 'mismatch', mapping, current: { width: current.width, height: current.height } };
};

/** Scales every corner by the canvas ratio and swaps the canvas; grid and crop are kept. */
export const scaleMapping = (m: Mapping, width: number, height: number): Mapping => {
  const sx = width / m.canvas.width;
  const sy = height / m.canvas.height;
  return {
    ...m,
    canvas: { width, height },
    surfaces: m.surfaces.map((s) => ({
      ...s,
      corners: s.corners.map(([x, y]) => [x * sx, y * sy] as const) as unknown as typeof s.corners,
    })),
  };
};
