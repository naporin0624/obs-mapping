import type { Mapping } from '../model/mapping';

export type IdPrefix = 's' | 'g';

/** The number part of an `s-3` / `g-3` style id, or null for any other id. */
export const idNumber = (id: string): number | null => {
  const hit = /^[sg]-(\d+)$/.exec(id);
  return hit === null ? null : Number(hit[1]);
};

const usedNumbers = (ids: Iterable<string>, prefix: IdPrefix): number[] =>
  [...ids].flatMap((id) => {
    const n = id.startsWith(`${prefix}-`) ? idNumber(id) : null;
    return n === null ? [] : [n];
  });

/** Surfaces and groups share one id namespace, so both are consulted. */
export const freshId = (m: Mapping, prefix: IdPrefix, taken: ReadonlySet<string> = new Set()): string => {
  const ids = [...m.surfaces.map((s) => s.id), ...m.groups.map((g) => g.id), ...taken];
  return `${prefix}-${Math.max(0, ...usedNumbers(ids, prefix)) + 1}`;
};
