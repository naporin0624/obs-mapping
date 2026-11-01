import { flatLayers } from './layers';
import type { Mapping, MappingV1 } from './mapping';
import { validateTree, type RawTree } from './validate-tree';

export type ReadResult = { kind: 'ok'; mapping: Mapping } | { kind: 'error'; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

const fail = (message: string): ReadResult => ({ kind: 'error', message });

/** v1 reads as a v2 whose surfaces all sit at the top level. */
export const upgradeV1 = (m: MappingV1): Mapping => ({ ...m, version: 2, groups: [], layers: flatLayers(m.surfaces) });

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

/** Structure and tree checks only; the plugin validates the surfaces themselves. */
export const readMapping = (json: unknown): ReadResult => {
  if (!isRecord(json)) return fail('json: expected an object');
  const problem = checkStructure(json);
  if (problem !== null) return fail(problem);
  // Both casts are backed by checkStructure (and validateTree for v2) just above.
  if (json['version'] === 1) return { kind: 'ok', mapping: upgradeV1(json as unknown as MappingV1) };
  const treeProblem = validateTree(json as unknown as RawTree);
  return treeProblem === null ? { kind: 'ok', mapping: json as unknown as Mapping } : fail(treeProblem);
};
