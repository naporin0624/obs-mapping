import { translateSurface } from '../geometry/align';
import { findParent, insertAfterNode, isGroupNode, removeNodes, sortSurfacesByLayers, subtreeIds, findNode } from '../model/layers';
import type { Group, LayerNode, Mapping, Surface } from '../model/mapping';
import { freshId } from './ids';

export const COPY_OFFSET = 20;
const COPY_SUFFIX = ' のコピー';

/** Drops ids that sit under another listed id, so only the ancestor is acted on. */
const topmostIds = (m: Mapping, ids: readonly string[]): string[] => {
  const present = ids.filter((id) => findNode(m.layers, id) !== null);
  const under = (other: string): string[] => Object.values(subtreeIds(m.layers, other)).flat();
  const covered = (id: string): boolean => present.some((other) => other !== id && under(other).includes(id));
  return present.filter((id) => !covered(id));
};

export const removeItems = (m: Mapping, ids: readonly string[]): Mapping => {
  const tops = topmostIds(m, ids);
  if (tops.length === 0) return m;
  const gone = tops.map((id) => subtreeIds(m.layers, id));
  const surfaceIds = new Set(gone.flatMap((g) => g.surfaceIds));
  const groupIds = new Set(gone.flatMap((g) => g.groupIds));
  return sortSurfacesByLayers({
    ...m,
    surfaces: m.surfaces.filter((s) => !surfaceIds.has(s.id)),
    groups: m.groups.filter((g) => !groupIds.has(g.id)),
    layers: removeNodes(m.layers, new Set([...surfaceIds, ...groupIds])),
  });
};

type Copy = { node: LayerNode; surfaces: Surface[]; groups: Group[]; topId: string; taken: ReadonlySet<string> };

/** Old id -> new id for every node under `id`; `taken` grows so the new ids never collide. */
const renamed = (m: Mapping, id: string, taken: ReadonlySet<string>): { ids: Map<string, string>; taken: Set<string> } => {
  const sub = subtreeIds(m.layers, id);
  const grown = new Set(taken);
  const ids = new Map<string, string>();
  const assign = (old: string, prefix: 's' | 'g'): void => {
    const fresh = freshId(m, prefix, grown);
    grown.add(fresh);
    ids.set(old, fresh);
  };
  sub.groupIds.forEach((old) => assign(old, 'g'));
  sub.surfaceIds.forEach((old) => assign(old, 's'));
  return { ids, taken: grown };
};

const remapNode = (n: LayerNode, ids: ReadonlyMap<string, string>): LayerNode =>
  isGroupNode(n) ? { group: ids.get(n.group) ?? n.group, children: n.children.map((c) => remapNode(c, ids)) } : { surface: ids.get(n.surface) ?? n.surface };

const copyOf = (m: Mapping, id: string, taken: ReadonlySet<string>): Copy => {
  const { ids, taken: grown } = renamed(m, id, taken);
  const offset = findParent(m.layers, id)?.parentId === null ? COPY_OFFSET : 0;
  const rename = (name: string, old: string): string => (old === id ? `${name}${COPY_SUFFIX}` : name);
  const surfaces = m.surfaces.filter((s) => ids.has(s.id)).map((s) => ({ ...translateSurface(s, offset, offset), id: ids.get(s.id) ?? s.id, name: rename(s.name, s.id) }));
  const groups = m.groups
    .filter((g) => ids.has(g.id))
    .map((g): Group => ({ ...g, id: ids.get(g.id) ?? g.id, name: rename(g.name, g.id), origin: g.id === id ? [g.origin[0] + offset, g.origin[1] + offset] : g.origin }));
  return { node: remapNode(findNode(m.layers, id) ?? { surface: id }, ids), surfaces, groups, topId: ids.get(id) ?? id, taken: grown };
};

export const duplicateItems = (m: Mapping, ids: readonly string[]): { mapping: Mapping; newSurfaceIds: string[]; newGroupIds: string[] } => {
  const tops = topmostIds(m, ids);
  if (tops.length === 0) return { mapping: m, newSurfaceIds: [], newGroupIds: [] };
  const copies = tops.reduce<(Copy & { source: string })[]>((acc, id) => {
    const taken = acc.at(-1)?.taken ?? new Set<string>();
    return [...acc, { ...copyOf(m, id, taken), source: id }];
  }, []);
  const mapping = sortSurfacesByLayers({
    ...m,
    surfaces: [...m.surfaces, ...copies.flatMap((c) => c.surfaces)],
    groups: [...m.groups, ...copies.flatMap((c) => c.groups)],
    layers: copies.reduce((layers, c) => insertAfterNode(layers, c.source, c.node), m.layers),
  });
  const isGroup = (c: Copy): boolean => isGroupNode(c.node);
  return {
    mapping,
    newSurfaceIds: copies.filter((c) => !isGroup(c)).map((c) => c.topId),
    newGroupIds: copies.filter(isGroup).map((c) => c.topId),
  };
};
