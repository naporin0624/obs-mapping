import { checkMasks } from './check-masks';
import { flatLayers } from './layers';
import type { Group, LayerNode, Mapping, MappingV1, Mask, Point, Surface } from './mapping';
import { validateTree, type RawTree } from './validate-tree';

export type ReadResult = { kind: 'ok'; mapping: Mapping } | { kind: 'error'; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

const fail = (message: string): ReadResult => ({ kind: 'error', message });

const readPoint = (p: Point): Point => [p[0], p[1]];

type RawSurface = Omit<Surface, 'visible'> & { visible?: boolean };
type RawGroup = Omit<Group, 'visible'> & { visible?: boolean };

const readMask = (m: Mask): Mask => (m.type === 'ellipse' ? { type: 'ellipse', x: m.x, y: m.y, width: m.width, height: m.height } : { type: 'polygon', points: m.points.map(readPoint) });

// The plugin owns the corner count check, so the points are mapped as given.
const readSurface = (s: RawSurface): Surface => ({
  id: s.id,
  name: s.name,
  type: s.type,
  source: s.source,
  crop: { x: s.crop.x, y: s.crop.y, width: s.crop.width, height: s.crop.height },
  corners: s.corners.map(readPoint) as unknown as Surface['corners'],
  visible: s.visible ?? true,
  ...(s.mask === undefined ? {} : { mask: readMask(s.mask) }),
});

const readGroup = (g: RawGroup): Group => ({
  id: g.id,
  name: g.name,
  visible: g.visible ?? true,
  origin: readPoint(g.origin),
  layout: { direction: g.layout.direction, gap: g.layout.gap, align: g.layout.align, padding: g.layout.padding },
});

const readNode = (n: LayerNode): LayerNode => ('group' in n ? { group: n.group, children: n.children.map(readNode) } : { surface: n.surface });

type Base = { canvas: MappingV1['canvas']; grid: MappingV1['grid']; surfaces: readonly RawSurface[] };

const readBase = (m: Base): Omit<MappingV1, 'version'> => ({
  canvas: { width: m.canvas.width, height: m.canvas.height },
  grid: { size: m.grid.size },
  surfaces: m.surfaces.map(readSurface),
});

const readV2 = (m: Mapping): Mapping => ({ version: 2, ...readBase(m), groups: m.groups.map(readGroup), layers: m.layers.map(readNode) });

/** v1 reads as a v2 whose surfaces all sit at the top level. */
export const upgradeV1 = (m: MappingV1): Mapping => {
  const base = readBase(m);
  return { version: 2, ...base, groups: [], layers: flatLayers(base.surfaces) };
};

const checkVersion = (version: unknown): string | null => {
  if (version === undefined) return 'version: missing';
  if (typeof version !== 'number' || !Number.isInteger(version)) return 'version: expected integer';
  return version === 1 || version === 2 ? null : `version: unsupported version ${String(version)}`;
};

const checkStructure = (json: Record<string, unknown>): string | null => {
  const { version, canvas, surfaces } = json;
  const problem = checkVersion(version);
  if (problem !== null) return problem;
  if (!isRecord(canvas)) return 'canvas: expected an object';
  if (!isPositive(canvas['width'])) return 'canvas.width: expected a positive number';
  if (!isPositive(canvas['height'])) return 'canvas.height: expected a positive number';
  return Array.isArray(surfaces) ? null : 'surfaces: expected an array';
};

const readChecked = (json: Record<string, unknown>): ReadResult => {
  const maskProblem = checkMasks(json['surfaces'] as unknown[]);
  if (maskProblem !== null) return fail(maskProblem);
  // Both casts are backed by checkStructure (and validateTree for v2) just above.
  if (json['version'] === 1) return { kind: 'ok', mapping: upgradeV1(json as unknown as MappingV1) };
  const treeProblem = validateTree(json as unknown as RawTree);
  return treeProblem === null ? { kind: 'ok', mapping: readV2(json as unknown as Mapping) } : fail(treeProblem);
};

/** Structure, tree and mask checks; the plugin validates the other surface fields. */
export const readMapping = (json: unknown): ReadResult => {
  if (!isRecord(json)) return fail('json: expected an object');
  const problem = checkStructure(json);
  if (problem !== null) return fail(problem);
  try {
    return readChecked(json);
  } catch (e) {
    if (e instanceof TypeError) return fail('json: a required field is missing or has the wrong type');
    throw e;
  }
};
