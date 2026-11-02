import { layoutTree } from '../layout/layout-tree';
import type { Group, Mapping } from '../model/mapping';
import { readMapping } from '../model/read';
import { MAX_SPACING } from '../model/validate-tree';

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

const clampSpacing = (v: number): number => Math.min(MAX_SPACING, Math.max(0, v));

const scaleGroup = (g: Group, sx: number, sy: number): Group => {
  const { direction, gap, padding } = g.layout;
  const layout = { ...g.layout, gap: clampSpacing(gap * (direction === 'row' ? sx : sy)), padding: clampSpacing(padding * Math.min(sx, sy)) };
  return { ...g, origin: [g.origin[0] * sx, g.origin[1] * sy], layout };
};

/** Scales corners, group origin, gap and padding by the canvas ratio, then re-lays out; grid and crop are kept. */
export const scaleMapping = (m: Mapping, width: number, height: number): Mapping => {
  const sx = width / m.canvas.width;
  const sy = height / m.canvas.height;
  return layoutTree({
    ...m,
    canvas: { width, height },
    surfaces: m.surfaces.map((s) => ({
      ...s,
      corners: s.corners.map(([x, y]) => [x * sx, y * sy] as const) as unknown as typeof s.corners,
    })),
    groups: m.groups.map((g) => scaleGroup(g, sx, sy)),
  });
};
