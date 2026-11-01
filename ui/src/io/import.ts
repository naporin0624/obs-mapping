import type { Mapping } from '../model/mapping';
import { readMapping } from '../model/read';

export type Canvas = Mapping['canvas'];

export type ImportResult = { kind: 'ok'; mapping: Mapping } | { kind: 'mismatch'; mapping: Mapping; current: Canvas } | { kind: 'error'; message: string };

export const parseImport = (text: string, current: Canvas): ImportResult => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { kind: 'error', message: `json: ${e instanceof Error ? e.message : String(e)}` };
  }
  const read = readMapping(json);
  if (read.kind === 'error') return read;
  const { mapping } = read;
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
