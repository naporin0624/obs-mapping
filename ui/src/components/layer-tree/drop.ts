import { findNode, findParent, fitsDepth, isGroupNode, moveNodes, subtreeIds, type NodeTarget } from '../../model/layers';
import type { Mapping } from '../../model/mapping';
import type { Action } from '../../editor/reducer';

export type TreeDrop = { key: string; dropPosition: 'before' | 'after' | 'on' };

const resolveTarget = (m: Mapping, drop: TreeDrop): NodeTarget | null => {
  const node = findNode(m.layers, drop.key);
  if (node === null) return null;
  if (drop.dropPosition === 'on') return isGroupNode(node) ? { parentId: drop.key, index: node.children.length } : null;
  const at = findParent(m.layers, drop.key);
  return at === null ? null : { parentId: at.parentId, index: at.index + (drop.dropPosition === 'after' ? 1 : 0) };
};

const insideDragged = (m: Mapping, dragged: ReadonlySet<string>, key: string): boolean =>
  [...dragged].some((id) => {
    const { surfaceIds, groupIds } = subtreeIds(m.layers, id);
    return surfaceIds.includes(key) || groupIds.includes(key);
  });

export const canDrop = (m: Mapping, dragged: ReadonlySet<string>, drop: TreeDrop): boolean => {
  const target = resolveTarget(m, drop);
  const known = dragged.size > 0 && [...dragged].every((id) => findNode(m.layers, id) !== null);
  if (target === null || !known || insideDragged(m, dragged, drop.key)) return false;
  return fitsDepth(m.layers, [...dragged], target.parentId) && moveNodes(m.layers, [...dragged], target) !== m.layers;
};

export const dropAction = (m: Mapping, dragged: ReadonlySet<string>, drop: TreeDrop): Action | null => {
  const target = resolveTarget(m, drop);
  return target !== null && canDrop(m, dragged, drop) ? { type: 'moveNodes', ids: [...dragged], target } : null;
};
