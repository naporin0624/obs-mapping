import { quadToUnit } from '../geometry/homography';
import { maskContains, polygonContains } from '../geometry/mask';
import { effectiveVisibleIds } from '../model/visibility';
import { findNode, isGroupNode, nodeId } from '../model/layers';
import type { LayerNode, Mapping, Point, Surface } from '../model/mapping';
import type { Selection } from './state';

const pathIn = (layers: readonly LayerNode[], id: string): string[] | null => {
  for (const n of layers) {
    if (nodeId(n) === id) return [id];
    const inner = isGroupNode(n) ? pathIn(n.children, id) : null;
    if (inner) return [nodeId(n), ...inner];
  }
  return null;
};

/** Ids from the outermost group down to the surface; just the surface when it is top level. */
export const pickPath = (m: Mapping, surfaceId: string): string[] => pathIn(m.layers, surfaceId) ?? [surfaceId];

const selectedIds = (sel: Selection): readonly string[] => [...sel.surfaceIds, ...sel.groupIds];

const childIds = (m: Mapping, groupId: string): string[] => {
  const node = findNode(m.layers, groupId);
  return node !== null && isGroupNode(node) ? node.children.map(nodeId) : [];
};

const reachesLevel = (m: Mapping, path: readonly string[], k: number, picked: readonly string[]): boolean => {
  const level = [path[k] ?? '', ...childIds(m, path[k - 1] ?? '')];
  return picked.some((id) => level.includes(id));
};

/** Plain click: stay at the level already drilled into, otherwise the outermost group. */
export const clickTarget = (m: Mapping, path: readonly string[], sel: Selection): string => {
  const picked = selectedIds(sel);
  const depths = path.map((_, k) => k).filter((k) => k >= 1);
  const k = depths.findLast((d) => reachesLevel(m, path, d, picked));
  return path[k ?? 0] ?? '';
};

/** Double click: one level deeper than the selected node on the path, or the outermost one. */
export const drillTarget = (path: readonly string[], sel: Selection): string => {
  const picked = selectedIds(sel);
  const k = path.findIndex((id) => picked.includes(id));
  return path[k < 0 ? 0 : Math.min(k + 1, path.length - 1)] ?? '';
};

export const deepTarget = (path: readonly string[]): string => path.at(-1) ?? '';

export const surfaceContains = (s: Surface, p: Point): boolean => {
  if (!polygonContains(s.corners, p)) return false;
  if (s.mask === undefined) return true;
  const unit = quadToUnit(s.corners, p);
  return unit !== null && maskContains(s.mask, unit);
};

/** Frontmost drawn surface containing the point. */
export const surfaceAt = (m: Mapping, p: Point): string | null => {
  const drawn = effectiveVisibleIds(m);
  return m.surfaces.findLast((s) => drawn.has(s.id) && surfaceContains(s, p))?.id ?? null;
};
