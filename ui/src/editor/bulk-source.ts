import { selectedSurfaceIdsDeep } from '../model/layers';
import type { Mapping, Surface } from '../model/mapping';
import type { Selection } from './state';

/** `source` is '' when every target is unassigned. */
export type SourceSummary = { kind: 'same'; source: string } | { kind: 'mixed'; count: number };

export const isBulkSelection = (sel: Selection): boolean => sel.surfaceIds.length + sel.groupIds.length >= 2;

/** Selected surfaces plus every surface under selected groups, once each, in layer-tree order. */
export const bulkTargets = (m: Mapping, sel: Selection): Surface[] => {
  const byId = new Map(m.surfaces.map((s) => [s.id, s]));
  return selectedSurfaceIdsDeep(m, sel).flatMap((id) => byId.get(id) ?? []);
};

export const summarizeSources = (targets: readonly Surface[]): SourceSummary => {
  const distinct = [...new Set(targets.map((s) => s.source))];
  return distinct.length > 1 ? { kind: 'mixed', count: distinct.length } : { kind: 'same', source: distinct[0] ?? '' };
};

/** OBS inputs, preceded by any assigned target source that OBS no longer lists. */
export const bulkSourceOptions = (inputs: readonly string[], targets: readonly Surface[]): string[] => {
  const missing = new Set(targets.map((s) => s.source).filter((source) => source !== '' && !inputs.includes(source)));
  return [...missing, ...inputs];
};
