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

const moveInList = (list: readonly LayerNode[], from: number, toIndex: number): LayerNode[] => {
  const item = list[from];
  if (item === undefined) return [...list];
  const rest = list.filter((_, i) => i !== from);
  const at = Math.max(0, Math.min(rest.length, toIndex));
  return [...rest.slice(0, at), item, ...rest.slice(at)];
};

export const moveWithinParent = (layers: readonly LayerNode[], id: string, toIndex: number): LayerNode[] => {
  const from = layers.findIndex((n) => nodeId(n) === id);
  if (from >= 0) return moveInList(layers, from, toIndex);
  return mapChildren(layers, (children) => moveWithinParent(children, id, toIndex));
};

const findNode = (layers: readonly LayerNode[], id: string): LayerNode | null => {
  const hit = layers.find((n) => nodeId(n) === id);
  if (hit !== undefined) return hit;
  return layers.filter(isGroupNode).reduce<LayerNode | null>((found, g) => found ?? findNode(g.children, id), null);
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
