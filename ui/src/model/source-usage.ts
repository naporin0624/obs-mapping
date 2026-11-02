import type { Mapping } from './mapping';

export const countSurfacesBySource = (mapping: Mapping): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const s of mapping.surfaces) {
    if (s.source !== '') counts.set(s.source, (counts.get(s.source) ?? 0) + 1);
  }
  return counts;
};
