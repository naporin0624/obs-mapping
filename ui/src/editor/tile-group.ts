import { rectCorners } from '../geometry/rect';
import { lineGrid, tileCells, type LineTile } from '../geometry/tile';
import { nodeSize } from '../layout/frame';
import { isGroupNode } from '../model/layers';
import type { Direction, GroupNode, Mapping } from '../model/mapping';
import { tileableSurfaceIds } from './items';
import type { Selection } from './state';

export type GroupTiling = { kind: 'ok'; ids: string[] } | { kind: 'blocked'; why: 'nested' | 'subgroup' | 'empty' };

export type TileTarget =
  | { kind: 'surfaces'; count: number }
  | { kind: 'group'; groupId: string; count: number; direction: Direction }
  | { kind: 'blocked'; why: 'noSurface' | 'mixed' | 'nested' | 'subgroup' | 'empty' };

const topLevelGroupNode = (m: Mapping, groupId: string): GroupNode | undefined => m.layers.find((n): n is GroupNode => isGroupNode(n) && n.group === groupId);

/** Only the children that layout places get a cell, so hidden surfaces keep theirs. */
export const groupTiling = (m: Mapping, groupId: string): GroupTiling => {
  const node = topLevelGroupNode(m, groupId);
  if (node === undefined) return { kind: 'blocked', why: 'nested' };
  if (node.children.some(isGroupNode)) return { kind: 'blocked', why: 'subgroup' };
  const ids = node.children.flatMap((c) => (!isGroupNode(c) && nodeSize(m, c) !== null ? [c.surface] : []));
  return ids.length === 0 ? { kind: 'blocked', why: 'empty' } : { kind: 'ok', ids };
};

const groupTarget = (m: Mapping, groupId: string): TileTarget => {
  const tiling = groupTiling(m, groupId);
  if (tiling.kind === 'blocked') return tiling;
  const direction = m.groups.find((g) => g.id === groupId)?.layout.direction ?? 'row';
  return { kind: 'group', groupId, count: tiling.ids.length, direction };
};

const surfacesTarget = (m: Mapping, sel: Selection): TileTarget => {
  const count = tileableSurfaceIds(m, sel).length;
  return count === 0 ? { kind: 'blocked', why: 'noSurface' } : { kind: 'surfaces', count };
};

/** What 敷き詰め would fit: loose surfaces, or exactly one group with nothing else selected. */
export const tileTarget = (m: Mapping, sel: Selection): TileTarget => {
  const [only, ...rest] = sel.groupIds;
  if (only === undefined) return surfacesTarget(m, sel);
  return rest.length === 0 && sel.surfaceIds.length === 0 ? groupTarget(m, only) : { kind: 'blocked', why: 'mixed' };
};

const isLineTile = ({ direction, gap }: LineTile): boolean => (direction === 'row' || direction === 'column') && Number.isFinite(gap) && gap >= 0;

/** Fits the group's children into equal cells across the canvas and makes the group flow the same way. */
export const tiledGroup = (m: Mapping, groupId: string, line: LineTile): Mapping => {
  const tiling = groupTiling(m, groupId);
  if (tiling.kind === 'blocked' || !isLineTile(line)) return m;
  const cells = tileCells({ x: 0, y: 0, ...m.canvas }, lineGrid(tiling.ids.length, line));
  if (cells.length === 0) return m;
  const target = new Map(tiling.ids.map((id, i) => [id, cells[i]] as const));
  return {
    ...m,
    surfaces: m.surfaces.map((s) => {
      const cell = target.get(s.id);
      return cell === undefined ? s : { ...s, corners: rectCorners(cell) };
    }),
    groups: m.groups.map((g) => (g.id === groupId ? { ...g, origin: [0, 0], layout: { direction: line.direction, gap: line.gap, align: 'start', padding: 0 } } : g)),
  };
};
