import { MAX_TREE_DEPTH } from './validate-tree';
import type { GroupNode, LayerNode, Mapping, Surface, SurfaceNode } from './mapping';

export const isGroupNode = (n: LayerNode): n is GroupNode => 'group' in n;

export const nodeId = (n: LayerNode): string => (isGroupNode(n) ? n.group : n.surface);

export const flatLayers = (surfaces: readonly Surface[]): SurfaceNode[] => surfaces.map((s) => ({ surface: s.id }));

export const dfsSurfaceIds = (layers: readonly LayerNode[]): string[] => layers.flatMap((n) => (isGroupNode(n) ? dfsSurfaceIds(n.children) : [n.surface]));

/** Reorders `surfaces` to the tree's depth-first order, which the plugin requires. */
export const sortSurfacesByLayers = (m: Mapping): Mapping => {
  const byId = new Map(m.surfaces.map((s) => [s.id, s]));
  const surfaces = dfsSurfaceIds(m.layers).flatMap((id) => byId.get(id) ?? []);
  return { ...m, surfaces };
};

export const findParent = (layers: readonly LayerNode[], id: string, parentId: string | null = null): { parentId: string | null; index: number } | null => {
  const index = layers.findIndex((n) => nodeId(n) === id);
  if (index >= 0) return { parentId, index };
  return layers.filter(isGroupNode).reduce<{ parentId: string | null; index: number } | null>((found, g) => found ?? findParent(g.children, id, g.group), null);
};

const mapChildren = (layers: readonly LayerNode[], f: (children: readonly LayerNode[]) => LayerNode[]): LayerNode[] => layers.map((n) => (isGroupNode(n) ? { ...n, children: f(n.children) } : n));

export const removeNodes = (layers: readonly LayerNode[], ids: ReadonlySet<string>): LayerNode[] =>
  mapChildren(
    layers.filter((n) => !ids.has(nodeId(n))),
    (children) => removeNodes(children, ids),
  );

export const insertAfterNode = (layers: readonly LayerNode[], anchorId: string, node: LayerNode): LayerNode[] => {
  const at = layers.findIndex((n) => nodeId(n) === anchorId);
  if (at >= 0) return [...layers.slice(0, at + 1), node, ...layers.slice(at + 1)];
  return mapChildren(layers, (children) => insertAfterNode(children, anchorId, node));
};

export const findNode = (layers: readonly LayerNode[], id: string): LayerNode | null => {
  const hit = layers.find((n) => nodeId(n) === id);
  if (hit !== undefined) return hit;
  return layers.filter(isGroupNode).reduce<LayerNode | null>((found, g) => found ?? findNode(g.children, id), null);
};

/** 1 for a top-level node, parent depth + 1 below; null when the id is absent. */
export const depthOf = (layers: readonly LayerNode[], id: string): number | null => {
  const hit = findParent(layers, id);
  if (hit === null) return null;
  return hit.parentId === null ? 1 : (depthOf(layers, hit.parentId) ?? 0) + 1;
};

const heightOf = (n: LayerNode): number => (isGroupNode(n) ? 1 + Math.max(0, ...n.children.map(heightOf)) : 1);

/** Levels in the subtree counting the node itself (a leaf is 1); 0 when the id is absent. */
export const subtreeHeight = (layers: readonly LayerNode[], id: string): number => {
  const node = findNode(layers, id);
  return node === null ? 0 : heightOf(node);
};

const collectIds = (n: LayerNode): { surfaceIds: string[]; groupIds: string[] } => {
  if (!isGroupNode(n)) return { surfaceIds: [n.surface], groupIds: [] };
  const inner = n.children.map(collectIds);
  return { surfaceIds: inner.flatMap((x) => x.surfaceIds), groupIds: [n.group, ...inner.flatMap((x) => x.groupIds)] };
};

/** The node's own id and every descendant's, split by kind. */
export const subtreeIds = (layers: readonly LayerNode[], id: string): { surfaceIds: string[]; groupIds: string[] } => {
  const node = findNode(layers, id);
  return node === null ? { surfaceIds: [], groupIds: [] } : collectIds(node);
};

export type NodeTarget = { parentId: string | null; index: number };

const childrenOf = (layers: readonly LayerNode[], parentId: string | null): readonly LayerNode[] | null => {
  if (parentId === null) return layers;
  const parent = findNode(layers, parentId);
  return parent !== null && isGroupNode(parent) ? parent.children : null;
};

const insertInto = (layers: readonly LayerNode[], parentId: string | null, index: number, nodes: readonly LayerNode[]): LayerNode[] => {
  if (parentId === null) return [...layers.slice(0, index), ...nodes, ...layers.slice(index)];
  return layers.map((n) => (isGroupNode(n) ? { ...n, children: insertInto(n.children, n.group === parentId ? null : parentId, index, nodes) } : n));
};

/** The listed nodes in tree order, skipping any whose ancestor is listed too. */
const topmostInOrder = (layers: readonly LayerNode[], ids: ReadonlySet<string>): LayerNode[] =>
  layers.flatMap((n) => (ids.has(nodeId(n)) ? [n] : isGroupNode(n) ? topmostInOrder(n.children, ids) : []));

/** True when every moved subtree still fits under MAX_TREE_DEPTH below the target parent. */
export const fitsDepth = (layers: readonly LayerNode[], ids: readonly string[], parentId: string | null): boolean => {
  const parentDepth = parentId === null ? 0 : depthOf(layers, parentId);
  return parentDepth !== null && ids.every((id) => parentDepth + subtreeHeight(layers, id) <= MAX_TREE_DEPTH);
};

const sameOrder = (a: readonly LayerNode[], b: readonly LayerNode[]): boolean => a.length === b.length && a.every((n, i) => nodeId(n) === nodeId(b[i] ?? n));

/** `target.index` counts the parent's children before the moved nodes are removed. */
export const moveNodes = (layers: readonly LayerNode[], ids: readonly string[], target: NodeTarget): readonly LayerNode[] => {
  const moved = topmostInOrder(layers, new Set(ids));
  const before = childrenOf(layers, target.parentId);
  const inMoved = target.parentId !== null && moved.some((n) => subtreeIds(layers, nodeId(n)).groupIds.includes(target.parentId ?? ''));
  if (moved.length === 0 || before === null || inMoved) return layers;
  const movedIds = new Set(moved.map(nodeId));
  const at = Math.max(0, Math.min(before.length, target.index));
  const index = at - before.slice(0, at).filter((n) => movedIds.has(nodeId(n))).length;
  const next = insertInto(removeNodes(layers, movedIds), target.parentId, index, moved);
  const after = childrenOf(next, target.parentId) ?? [];
  return sameOrder(before, after) ? layers : next;
};
