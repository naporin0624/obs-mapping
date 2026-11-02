import { translateSurface, type Item } from '../geometry/align';
import { boundsOf } from '../geometry/rect';
import { groupFrame, nodeSize } from '../layout/frame';
import { findParent, isGroupNode, nodeId } from '../model/layers';
import type { LayerNode, Mapping, Point } from '../model/mapping';
import type { Selection } from './state';

export const isLaidOut = (m: Mapping, id: string): boolean => {
  const parent = findParent(m.layers, id);
  return parent !== null && parent.parentId !== null;
};

const pathTo = (layers: readonly LayerNode[], id: string): LayerNode[] | null => {
  for (const n of layers) {
    if (nodeId(n) === id) return [n];
    const inner = isGroupNode(n) ? pathTo(n.children, id) : null;
    if (inner) return [n, ...inner];
  }
  return null;
};

const childrenOf = (n: LayerNode): readonly LayerNode[] => (isGroupNode(n) ? n.children : []);

const isFirstVisible = (m: Mapping, siblings: readonly LayerNode[], node: LayerNode): boolean => siblings.find((n) => nodeSize(m, n) !== null) === node;

/** Top-level nodes are not a flow, so only levels inside a group must lead. */
export const leadingRoot = (m: Mapping, surfaceId: string): string | null => {
  const path = pathTo(m.layers, surfaceId);
  const root = path?.[0];
  if (!path || path.length < 2 || !root) return null;
  const leading = path.slice(1).every((node, i) => isFirstVisible(m, childrenOf(path[i]!), node));
  return leading ? nodeId(root) : null;
};

const isTopLevel = (m: Mapping, id: string): boolean => findParent(m.layers, id)?.parentId === null;

const itemOf = (m: Mapping, id: string): Item | null => {
  const s = m.surfaces.find((x) => x.id === id);
  if (s) return { id, bounds: boundsOf(s) };
  return m.groups.some((g) => g.id === id) ? { id, bounds: groupFrame(m, id) } : null;
};

/** Selected top-level surfaces and groups; a group is represented by its frame. */
export const movableItems = (m: Mapping, sel: Selection): Item[] => [...sel.surfaceIds, ...sel.groupIds].filter((id) => isTopLevel(m, id)).flatMap((id) => itemOf(m, id) ?? []);

export const moveItem = (m: Mapping, id: string, d: Point): Mapping => {
  if (!isTopLevel(m, id)) return m;
  if (m.surfaces.some((s) => s.id === id)) return { ...m, surfaces: m.surfaces.map((s) => (s.id === id ? translateSurface(s, d[0], d[1]) : s)) };
  return { ...m, groups: m.groups.map((g) => (g.id === id ? { ...g, origin: [g.origin[0] + d[0], g.origin[1] + d[1]] } : g)) };
};
