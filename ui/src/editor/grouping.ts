import { inferGroup } from '../layout/group-inference';
import { depthOf, findNode, findParent, isGroupNode, nodeId, sortSurfacesByLayers, subtreeHeight } from '../model/layers';
import type { Group, LayerNode, Mapping } from '../model/mapping';
import { idNumber } from './ids';
import { MAX_TREE_DEPTH } from '../model/validate-tree';
import type { Selection } from './state';

export type GroupProblem = 'empty' | 'mixedParents' | 'tooDeep';

export const selectedItemIds = (sel: Selection): string[] => [...sel.surfaceIds, ...sel.groupIds];

/** Rewrites the sibling list under `parentId` (null is the top level). */
const editSiblings = (layers: readonly LayerNode[], parentId: string | null, f: (list: readonly LayerNode[]) => LayerNode[]): LayerNode[] => {
  if (parentId === null) return f(layers);
  return layers.map((n) => (isGroupNode(n) ? { ...n, children: n.group === parentId ? f(n.children) : editSiblings(n.children, parentId, f) } : n));
};

const parentsOf = (m: Mapping, ids: readonly string[]) => ids.map((id) => findParent(m.layers, id));

type Siblings = 'none' | 'mixed' | 'same';

const siblingsOf = (m: Mapping, ids: readonly string[]): Siblings => {
  const parents = parentsOf(m, ids);
  if (parents.length === 0 || parents.includes(null)) return 'none';
  return new Set(parents.map((p) => p?.parentId)).size === 1 ? 'same' : 'mixed';
};

const tooDeep = (m: Mapping, ids: readonly string[]): boolean => {
  const first = ids[0];
  const depth = first === undefined ? 0 : (depthOf(m.layers, first) ?? 0);
  // The new group sits at the items' depth; its children land one level lower.
  return depth + Math.max(0, ...ids.map((id) => subtreeHeight(m.layers, id))) > MAX_TREE_DEPTH;
};

export const groupProblem = (m: Mapping, sel: Selection): GroupProblem | null => {
  const ids = selectedItemIds(sel);
  const siblings = siblingsOf(m, ids);
  if (siblings === 'none') return 'empty';
  if (siblings === 'mixed') return 'mixedParents';
  return tooDeep(m, ids) ? 'tooDeep' : null;
};

const nodesOf = (m: Mapping, ids: readonly string[]): LayerNode[] => ids.flatMap((id) => findNode(m.layers, id) ?? []);

const newGroup = (groupId: string, inferred: ReturnType<typeof inferGroup>, name: (number: string) => string): Group => ({
  id: groupId,
  name: name(String(idNumber(groupId) ?? groupId)),
  visible: true,
  origin: inferred.origin,
  layout: inferred.layout,
});

const wrapped = (list: readonly LayerNode[], ids: readonly string[], node: LayerNode): LayerNode[] => {
  const first = list.findIndex((n) => ids.includes(nodeId(n)));
  const rest = list.filter((n) => !ids.includes(nodeId(n)));
  return [...rest.slice(0, first), node, ...rest.slice(first)];
};

export const groupItems = (m: Mapping, itemIds: readonly string[], groupId: string, name: (number: string) => string): Mapping | null => {
  if (siblingsOf(m, itemIds) !== 'same') return null;
  const inferred = inferGroup(m, itemIds);
  const node: LayerNode = { group: groupId, children: nodesOf(m, inferred.order) };
  const parentId = findParent(m.layers, itemIds[0] ?? '')?.parentId ?? null;
  return sortSurfacesByLayers({
    ...m,
    groups: [...m.groups, newGroup(groupId, inferred, name)],
    layers: editSiblings(m.layers, parentId, (list) => wrapped(list, itemIds, node)),
  });
};

const spliced = (list: readonly LayerNode[], groupId: string): LayerNode[] =>
  list.flatMap((n) => {
    if (!isGroupNode(n)) return [n];
    return n.group === groupId ? n.children : [{ ...n, children: spliced(n.children, groupId) }];
  });

const exists = (m: Mapping, id: string): boolean => findParent(m.layers, id) !== null;

const hiddenChildren = (m: Mapping, ids: readonly string[]): Mapping => ({
  ...m,
  surfaces: m.surfaces.map((s) => (ids.includes(s.id) ? { ...s, visible: false } : s)),
  groups: m.groups.map((g) => (ids.includes(g.id) ? { ...g, visible: false } : g)),
});

const ungroupOne = (m: Mapping, groupId: string): { mapping: Mapping; childIds: string[] } => {
  const node = findNode(m.layers, groupId);
  if (node === null || !isGroupNode(node)) return { mapping: m, childIds: [] };
  const childIds = node.children.map(nodeId);
  const hidden = m.groups.find((g) => g.id === groupId)?.visible === false;
  const kept = { ...m, groups: m.groups.filter((g) => g.id !== groupId), layers: spliced(m.layers, groupId) };
  return { mapping: hidden ? hiddenChildren(kept, childIds) : kept, childIds };
};

export const ungroupItems = (m: Mapping, groupIds: readonly string[]): { mapping: Mapping; childIds: string[] } => {
  const done = groupIds.reduce(
    (acc, id) => {
      const one = ungroupOne(acc.mapping, id);
      return { mapping: one.mapping, childIds: [...acc.childIds, ...one.childIds] };
    },
    { mapping: m, childIds: [] as string[] },
  );
  return { mapping: sortSurfacesByLayers(done.mapping), childIds: done.childIds.filter((id) => exists(done.mapping, id)) };
};
