import type { Key } from 'react-aria-components';
import type { Selection } from '../../editor/state';
import type { Mapping } from '../../model/mapping';
import { toIdSet } from './tree-dnd';

export const selectionOfKeys = (m: Mapping, keys: 'all' | ReadonlySet<Key>): Selection => {
  const ids = keys === 'all' ? new Set([...m.surfaces.map((s) => s.id), ...m.groups.map((g) => g.id)]) : toIdSet(keys);
  return { surfaceIds: m.surfaces.map((s) => s.id).filter((id) => ids.has(id)), groupIds: m.groups.map((g) => g.id).filter((id) => ids.has(id)), corner: null };
};
