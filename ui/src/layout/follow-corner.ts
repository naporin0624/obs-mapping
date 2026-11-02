import { leadingRoot } from '../editor/items';
import type { CornerIndex } from '../editor/state';
import type { Mapping, Point } from '../model/mapping';
import { layoutTree } from './layout-tree';

const withCorner = (m: Mapping, surfaceId: string, index: CornerIndex, to: Point): Mapping => ({
  ...m,
  surfaces: m.surfaces.map((s) => (s.id === surfaceId ? { ...s, corners: s.corners.map((p, i) => (i === index ? to : p)) as unknown as typeof s.corners } : s)),
});

const withOriginShift = (m: Mapping, groupId: string, d: Point): Mapping => ({
  ...m,
  groups: m.groups.map((g) => (g.id === groupId ? { ...g, origin: [g.origin[0] + d[0], g.origin[1] + d[1]] } : g)),
});

export const followCorner = (m: Mapping, surfaceId: string, index: CornerIndex, to: Point): Mapping => {
  const laid = layoutTree(withCorner(m, surfaceId, index, to));
  const root = leadingRoot(m, surfaceId);
  const corner = laid.surfaces.find((s) => s.id === surfaceId)?.corners[index];
  if (root === null || !corner) return laid;
  const shift: Point = [Math.min(0, to[0] - corner[0]), Math.min(0, to[1] - corner[1])];
  return shift[0] === 0 && shift[1] === 0 ? laid : layoutTree(withOriginShift(laid, root, shift));
};
