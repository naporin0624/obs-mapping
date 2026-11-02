import type { Key } from 'react-aria-components';
import type { Action } from '../../editor/reducer';
import type { Mapping } from '../../model/mapping';
import { canDrop, dropAction } from './drop';

export type TreeDropTarget = { type: 'root' } | { type: 'item'; key: Key; dropPosition: 'before' | 'after' | 'on' };

export const toIdSet = (keys: Iterable<Key>): Set<string> => new Set([...keys].map(String));

export const dropOperationFor = (m: Mapping, dragged: ReadonlySet<string>, target: TreeDropTarget): 'move' | 'cancel' =>
  target.type === 'item' && canDrop(m, dragged, { key: String(target.key), dropPosition: target.dropPosition }) ? 'move' : 'cancel';

export const dropActionFor = (m: Mapping, dragged: ReadonlySet<Key>, target: TreeDropTarget): Action | null =>
  target.type === 'item' ? dropAction(m, toIdSet(dragged), { key: String(target.key), dropPosition: target.dropPosition }) : null;
